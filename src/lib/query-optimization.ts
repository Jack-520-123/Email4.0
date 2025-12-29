import { prisma } from './prisma'
import { Prisma, CampaignStatus } from '@prisma/client'

/**
 * 查询优化工具类
 * 提供优化的数据库查询方法，减少查询次数和提高性能
 */

export class QueryOptimization {
  private static instance: QueryOptimization
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

  static getInstance(): QueryOptimization {
    if (!QueryOptimization.instance) {
      QueryOptimization.instance = new QueryOptimization()
    }
    return QueryOptimization.instance
  }

  // 带缓存的查询方法
  private async cachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = this.DEFAULT_CACHE_TTL
  ): Promise<T> {
    const cached = this.queryCache.get(key)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.data as T
    }

    const result = await queryFn()
    this.queryCache.set(key, {
      data: result,
      timestamp: now,
      ttl
    })

    return result
  }

  // 清除缓存
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.queryCache.keys()) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key)
        }
      }
    } else {
      this.queryCache.clear()
    }
  }

  // 优化的活动查询 - 包含所有必要的关联数据
  async getCampaignWithDetails(campaignId: string, userId: string) {
    const cacheKey = `campaign_details_${campaignId}_${userId}`
    
    return this.cachedQuery(cacheKey, async () => {
      return prisma.campaign.findFirst({
        where: {
          id: campaignId,
          userId: userId
        },
        include: {
          recipientList: {
            include: {
              recipients: {
                select: {
                  id: true,
                  email: true,
                  name: true
                }
              }
            }
          },
          emailProfile: {
            select: {
              id: true,
              nickname: true,
              email: true,
              smtpServer: true,
              smtpPort: true
            }
          },
          template: {
            select: {
              id: true,
              name: true,
              subject: true,
              htmlContent: true
            }
          },
          _count: {
            select: {
              sentEmails: true
            }
          }
        }
      })
    }, 2 * 60 * 1000) // 2分钟缓存
  }

  // 批量检查邮件是否已发送
  async checkEmailsSentInBatch(
    campaignId: string,
    emails: string[]
  ): Promise<Set<string>> {
    if (emails.length === 0) return new Set()

    const sentEmails = await prisma.sentEmail.findMany({
      where: {
        campaignId,
        recipientEmail: {
          in: emails
        }
      },
      select: {
        recipientEmail: true
      }
    })

    return new Set(sentEmails.map(email => email.recipientEmail))
  }

  // 优化的用户邮件配置查询
  async getUserActiveEmailProfiles(userId: string) {
    const cacheKey = `user_email_profiles_${userId}`
    
    return this.cachedQuery(cacheKey, async () => {
      return prisma.emailProfile.findMany({
        where: {
          userId
        },
        select: {
          id: true,
          nickname: true,
          email: true,
          smtpServer: true,
          smtpPort: true,
          password: true,
          maxEmailsPerHour: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      })
    }, 10 * 60 * 1000) // 10分钟缓存
  }

  // 批量获取收件人信息
  async getRecipientsInBatch(listId: string, limit?: number): Promise<any[]> {
    const cacheKey = `recipients_${listId}_${limit || 'all'}`
    
    return this.cachedQuery(cacheKey, async () => {
      return prisma.recipient.findMany({
        where: {
          recipientListId: listId
        },
        select: {
          id: true,
          email: true,
          name: true
        },
        ...(limit && { take: limit }),
        orderBy: {
          createdAt: 'asc'
        }
      })
    }, 5 * 60 * 1000) // 5分钟缓存
  }

  // 获取活动发送统计（优化版）
  async getCampaignStats(campaignId: string) {
    const cacheKey = `campaign_stats_${campaignId}`
    
    return this.cachedQuery(cacheKey, async () => {
      const [campaign, sentStats] = await Promise.all([
        prisma.campaign.findUnique({
          where: { id: campaignId },
          select: {
            id: true,
            sentCount: true,
            failedCount: true,
            totalRecipients: true,
            status: true,
            lastSentAt: true
          }
        }),
        prisma.sentEmail.groupBy({
          by: ['status'],
          where: {
            campaignId
          },
          _count: {
            status: true
          }
        })
      ])

      const stats = {
        sent: 0,
        failed: 0,
        pending: 0
      }

      sentStats.forEach(stat => {
        if (stat.status === 'sent') {
          stats.sent = stat._count.status
        } else if (stat.status === 'failed') {
          stats.failed = stat._count.status
        }
      })

      if (campaign) {
        stats.pending = Math.max(0, (campaign.totalRecipients || 0) - stats.sent - stats.failed)
      }

      return {
        campaign,
        stats
      }
    }, 30 * 1000) // 30秒缓存
  }

  // 获取用户活动列表（分页优化）
  async getUserCampaigns(
    userId: string,
    page: number = 1,
    pageSize: number = 10,
    status?: CampaignStatus
  ) {
    const offset = (page - 1) * pageSize
    const cacheKey = `user_campaigns_${userId}_${page}_${pageSize}_${status || 'all'}`
    
    return this.cachedQuery(cacheKey, async () => {
      const where: Prisma.CampaignWhereInput = {
        userId,
        ...(status && { status })
      }

      const [campaigns, total] = await Promise.all([
        prisma.campaign.findMany({
          where,
          select: {
            id: true,
            name: true,
            status: true,
            sentCount: true,
            failedCount: true,
            totalRecipients: true,
            createdAt: true,
            lastSentAt: true,
            template: {
              select: {
                name: true,
                subject: true
              }
            },
            recipientList: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: offset,
          take: pageSize
        }),
        prisma.campaign.count({ where })
      ])

      return {
        campaigns,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    }, 2 * 60 * 1000) // 2分钟缓存
  }

  // 获取活动日志（分页优化）
  async getCampaignLogs(
    campaignId: string,
    page: number = 1,
    pageSize: number = 50,
    level?: string
  ) {
    const offset = (page - 1) * pageSize
    const cacheKey = `campaign_logs_${campaignId}_${page}_${pageSize}_${level || 'all'}`
    
    return this.cachedQuery(cacheKey, async () => {
      const where: Prisma.CampaignLogWhereInput = {
        campaignId,
        ...(level && { level })
      }

      const [logs, total] = await Promise.all([
        prisma.campaignLog.findMany({
          where,
          select: {
            id: true,
            level: true,
            message: true,
            details: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: offset,
          take: pageSize
        }),
        prisma.campaignLog.count({ where })
      ])

      return {
        logs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    }, 1 * 60 * 1000) // 1分钟缓存
  }

  // 检查邮件配置可用性
  async checkEmailProfileAvailability(profileId: string): Promise<boolean> {
    const cacheKey = `email_profile_availability_${profileId}`
    
    return this.cachedQuery(cacheKey, async () => {
      const profile = await prisma.emailProfile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          maxEmailsPerHour: true
        }
      })

      if (!profile) {
        return false
      }

      // 简单的可用性检查，可以根据需要扩展
      return true
    }, 1 * 60 * 1000) // 1分钟缓存
  }

  // 获取数据库连接状态
  async getDatabaseConnectionStatus(): Promise<any> {
    try {
      const result = await prisma.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `
      
      return result
    } catch (error) {
      console.error('[QueryOptimization] 获取数据库连接状态失败:', error)
      return null
    }
  }

  // 清理过期缓存
  cleanupExpiredCache(): void {
    const now = Date.now()
    for (const [key, value] of this.queryCache.entries()) {
      if ((now - value.timestamp) >= value.ttl) {
        this.queryCache.delete(key)
      }
    }
  }
}

// 导出单例实例
export const queryOptimization = QueryOptimization.getInstance()

// 定期清理过期缓存
setInterval(() => {
  queryOptimization.cleanupExpiredCache()
}, 5 * 60 * 1000) // 每5分钟清理一次