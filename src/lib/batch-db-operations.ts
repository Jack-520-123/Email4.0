import { PrismaClient } from '@prisma/client'
import { prisma } from './prisma'

// 批量数据库操作接口
interface BatchSentEmailData {
  id: string
  userId: string
  campaignId: string
  emailProfileId: string
  recipientEmail: string
  recipientName: string
  subject: string
  body: string
  status: 'sent' | 'failed'
  sentAt: Date
  messageId?: string | null
  errorMessage?: string | null
}

interface BatchCampaignLogData {
  campaignId: string
  level: 'info' | 'warning' | 'error'
  message: string
  details: any
}

interface CampaignStatsUpdate {
  campaignId: string
  sentCount?: number
  failedCount?: number
  lastSentAt?: Date
}

// 批量操作管理器
export class BatchDatabaseOperations {
  private static instance: BatchDatabaseOperations
  private sentEmailBatch: BatchSentEmailData[] = []
  private campaignLogBatch: BatchCampaignLogData[] = []
  private campaignStatsBatch: Map<string, CampaignStatsUpdate> = new Map()
  private batchTimer: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = process.env.NODE_ENV === 'production' ? 30 : 50 // 生产环境减少批量大小
  private readonly BATCH_TIMEOUT = process.env.NODE_ENV === 'production' ? 10000 : 5000 // 生产环境10秒超时

  static getInstance(): BatchDatabaseOperations {
    if (!BatchDatabaseOperations.instance) {
      BatchDatabaseOperations.instance = new BatchDatabaseOperations()
    }
    return BatchDatabaseOperations.instance
  }

  // 添加邮件发送记录到批量队列
  addSentEmail(data: BatchSentEmailData): void {
    this.sentEmailBatch.push(data)
    this.scheduleBatchFlush()
  }

  // 添加活动日志到批量队列
  addCampaignLog(data: BatchCampaignLogData): void {
    this.campaignLogBatch.push(data)
    this.scheduleBatchFlush()
  }

  // 添加活动统计更新到批量队列
  addCampaignStatsUpdate(data: CampaignStatsUpdate): void {
    const existing = this.campaignStatsBatch.get(data.campaignId)
    if (existing) {
      // 合并统计数据
      existing.sentCount = (existing.sentCount || 0) + (data.sentCount || 0)
      existing.failedCount = (existing.failedCount || 0) + (data.failedCount || 0)
      if (data.lastSentAt) {
        existing.lastSentAt = data.lastSentAt
      }
    } else {
      this.campaignStatsBatch.set(data.campaignId, { ...data })
    }
    this.scheduleBatchFlush()
  }

  // 调度批量刷新
  private scheduleBatchFlush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }

    // 如果达到批量大小，立即执行
    const totalItems = this.sentEmailBatch.length + this.campaignLogBatch.length + this.campaignStatsBatch.size
    if (totalItems >= this.BATCH_SIZE) {
      this.flushBatches()
      return
    }

    // 否则设置定时器
    this.batchTimer = setTimeout(() => {
      this.flushBatches()
    }, this.BATCH_TIMEOUT)
  }

  // 执行批量操作
  private async flushBatches(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 批量创建邮件发送记录
        if (this.sentEmailBatch.length > 0) {
          await tx.sentEmail.createMany({
            data: this.sentEmailBatch,
            skipDuplicates: true // 跳过重复记录
          })
          console.log(`[BatchDB] 批量创建 ${this.sentEmailBatch.length} 条邮件发送记录`)
        }

        // 批量创建活动日志
        if (this.campaignLogBatch.length > 0) {
          await tx.campaignLog.createMany({
            data: this.campaignLogBatch
          })
          console.log(`[BatchDB] 批量创建 ${this.campaignLogBatch.length} 条活动日志`)
        }

        // 批量更新活动统计
        if (this.campaignStatsBatch.size > 0) {
          const updatePromises = Array.from(this.campaignStatsBatch.entries()).map(([campaignId, stats]) => {
            const updateData: any = {}
            if (stats.sentCount && stats.sentCount > 0) {
              updateData.sentCount = { increment: stats.sentCount }
            }
            if (stats.failedCount && stats.failedCount > 0) {
              updateData.failedCount = { increment: stats.failedCount }
            }
            if (stats.lastSentAt) {
              updateData.lastSentAt = stats.lastSentAt
            }

            if (Object.keys(updateData).length > 0) {
              return tx.campaign.update({
                where: { id: campaignId },
                data: updateData
              })
            }
            return Promise.resolve()
          })

          await Promise.all(updatePromises)
          console.log(`[BatchDB] 批量更新 ${this.campaignStatsBatch.size} 个活动统计`)
        }
      })

      // 清空批量队列
      this.sentEmailBatch = []
      this.campaignLogBatch = []
      this.campaignStatsBatch.clear()

    } catch (error) {
      console.error('[BatchDB] 批量操作失败:', error)
      // 发生错误时，可以选择重试或者回退到单个操作
      // 这里我们选择清空队列，避免无限重试
      this.sentEmailBatch = []
      this.campaignLogBatch = []
      this.campaignStatsBatch.clear()
    }
  }

  // 强制刷新所有批量操作
  async forceFlush(): Promise<void> {
    await this.flushBatches()
  }

  // 获取当前批量队列状态
  getBatchStatus(): {
    sentEmailCount: number
    campaignLogCount: number
    campaignStatsCount: number
  } {
    return {
      sentEmailCount: this.sentEmailBatch.length,
      campaignLogCount: this.campaignLogBatch.length,
      campaignStatsCount: this.campaignStatsBatch.size
    }
  }

  // 获取统计信息（用于性能监控）
  getStats(): {
    batchSize: number
    batchTimeout: number
    currentBatches: {
      sentEmailCount: number
      campaignLogCount: number
      campaignStatsCount: number
    }
    isTimerActive: boolean
  } {
    return {
      batchSize: this.BATCH_SIZE,
      batchTimeout: this.BATCH_TIMEOUT,
      currentBatches: this.getBatchStatus(),
      isTimerActive: this.batchTimer !== null
    }
  }

  // 检查邮件是否已存在（优化版本，使用批量查询）
  async checkExistingSentEmails(emailIds: string[]): Promise<Set<string>> {
    if (emailIds.length === 0) return new Set()

    const existingEmails = await prisma.sentEmail.findMany({
      where: {
        id: { in: emailIds }
      },
      select: { id: true }
    })

    return new Set(existingEmails.map(email => email.id))
  }

  // 检查失败邮件是否已存在（优化版本）
  async checkExistingFailedEmails(campaignId: string, recipientEmails: string[]): Promise<Set<string>> {
    if (recipientEmails.length === 0) return new Set()

    const existingFailedEmails = await prisma.sentEmail.findMany({
      where: {
        campaignId,
        recipientEmail: { in: recipientEmails },
        status: 'failed'
      },
      select: { recipientEmail: true }
    })

    return new Set(existingFailedEmails.map(email => email.recipientEmail))
  }

  // 批量获取活动信息（优化版本）
  async getCampaignInfoBatch(campaignIds: string[]): Promise<Map<string, { userId: string; emailProfileId: string }>> {
    if (campaignIds.length === 0) return new Map()

    const campaigns = await prisma.campaign.findMany({
      where: {
        id: { in: campaignIds }
      },
      select: {
        id: true,
        userId: true,
        emailProfileId: true
      }
    })

    const result = new Map<string, { userId: string; emailProfileId: string }>()
    campaigns.forEach(campaign => {
      if (campaign.emailProfileId) {
        result.set(campaign.id, {
          userId: campaign.userId,
          emailProfileId: campaign.emailProfileId
        })
      }
    })

    return result
  }
}

// 导出单例实例
export const batchDB = BatchDatabaseOperations.getInstance()