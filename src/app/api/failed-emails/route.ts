import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EmailStatus } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

// 获取失败邮箱列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户会话
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    console.log('失败邮件API - 用户ID:', userId);

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const campaignId = searchParams.get('campaignId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    // 构建查询条件 - 只显示当前用户的失败邮件
    const where: any = {
      userId: userId // 确保数据隔离
    }

    console.log('失败邮件API - 用户数据隔离已启用，用户ID:', userId);

    if (campaignId) {
      where.campaignId = campaignId
      console.log('失败邮件API - 添加活动ID过滤:', campaignId);
    }

    // 处理状态过滤
    if (status && status !== 'all') {
      // 支持大写和小写状态值
      const statusValue = status.toLowerCase()
      where.status = statusValue
      console.log('失败邮件API - 指定状态过滤:', statusValue);
    } else {
      // 默认只显示失败状态的邮件（使用小写状态值，因为数据库中存储的是小写）
      where.status = {
        in: ['failed', 'bounced', 'rejected', 'invalid', 'blacklisted']
      }
      console.log('失败邮件API - 使用默认失败状态过滤');
    }

    if (search) {
      where.OR = [
        { recipientEmail: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } }
      ]
    }

    // 添加调试日志
    console.log('失败邮箱API查询条件:', JSON.stringify(where, null, 2));

    // 获取失败邮件列表
    const [failedEmails, total] = await Promise.all([
      prisma.sentEmail.findMany({
        where,
        include: {
          campaign: {
            select: {
              id: true,
              name: true
            }
          },
          recipient: {
            select: {
              id: true,
              email: true,
              name: true,
              isBlacklisted: true,
              failureCount: true,
              bounceCount: true,
              lastFailureReason: true
            }
          },
          emailProfile: {
            select: {
              id: true,
              email: true,
              nickname: true
            }
          }
        },
        orderBy: {
          sentAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.sentEmail.count({ where })
    ])

    console.log('失败邮件API - 查询结果数量:', failedEmails.length);
    console.log('失败邮件API - 总数:', total);
    if (failedEmails.length > 0) {
      console.log('失败邮件API - 第一条邮件示例:', {
        id: failedEmails[0].id,
        userId: failedEmails[0].userId,
        recipientEmail: failedEmails[0].recipientEmail,
        status: failedEmails[0].status
      });
    }

    // 处理没有关联recipient的邮件记录
    const processedFailedEmails = failedEmails.map(email => {
      if (!email.recipient) {
        // 为没有recipient的邮件创建虚拟recipient对象
        return {
          ...email,
          recipient: {
            id: 'virtual-' + email.id,
            email: email.recipientEmail,
            name: email.recipientName || email.recipientEmail,
            isBlacklisted: false,
            failureCount: 1,
            bounceCount: 0,
            lastFailureReason: email.errorMessage || '未知错误'
          }
        }
      }
      return email
    })

    console.log('查询结果 - 失败邮件数量:', failedEmails.length, '总数:', total);

    // 获取统计信息
    const stats = await prisma.sentEmail.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true
      }
    })

    // 处理统计数据
    const processedStats = {
      total: total,
      failed: 0,
      bounced: 0,
      rejected: 0,
      invalid: 0,
      blacklisted: 0
    }

    stats.forEach(stat => {
      switch (stat.status) {
        case 'failed':
          processedStats.failed = stat._count.id
          break
        case 'bounced':
          processedStats.bounced = stat._count.id
          break
        case 'rejected':
          processedStats.rejected = stat._count.id
          break
        case 'invalid':
          processedStats.invalid = stat._count.id
          break
        case 'blacklisted':
          processedStats.blacklisted = stat._count.id
          break
      }
    })

    // 增强统计：按活动分组
    const byCampaignStats = await prisma.sentEmail.groupBy({
      by: ['campaignId'],
      where,
      _count: {
        id: true
      }
    })

    // 获取活动详情
    const campaignIds = byCampaignStats.map(s => s.campaignId)
    const campaigns = await prisma.campaign.findMany({
      where: {
        id: { in: campaignIds }
      },
      select: {
        id: true,
        name: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true
      }
    })

    const byCampaign = byCampaignStats.map(stat => {
      const campaign = campaigns.find(c => c.id === stat.campaignId)
      const failedCount = stat._count.id
      const totalCount = campaign?.totalRecipients || 0
      return {
        campaignId: stat.campaignId,
        campaignName: campaign?.name || '未知活动',
        failedCount,
        totalCount,
        failureRate: totalCount > 0 ? ((failedCount / totalCount) * 100).toFixed(2) + '%' : '0%'
      }
    }).slice(0, 10) // 只返回前10个活动

    // 增强统计：最近7天趋势
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentFailures = await prisma.sentEmail.findMany({
      where: {
        ...where,
        sentAt: {
          gte: sevenDaysAgo
        }
      },
      select: {
        sentAt: true
      }
    })

    // 按日期分组
    const trendByDate: { [key: string]: number } = {}
    recentFailures.forEach(email => {
      const date = new Date(email.sentAt).toISOString().split('T')[0]
      trendByDate[date] = (trendByDate[date] || 0) + 1
    })

    const recentTrend = Object.entries(trendByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      success: true,
      data: {
        failedEmails: processedFailedEmails,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: processedStats,
        // 新增详细统计
        analytics: {
          byCampaign,
          recentTrend,
          summary: {
            avgFailureRate: byCampaign.length > 0
              ? (byCampaign.reduce((sum, c) => sum + parseFloat(c.failureRate), 0) / byCampaign.length).toFixed(2) + '%'
              : '0%',
            mostFailedCampaign: byCampaign.length > 0
              ? byCampaign.reduce((max, c) => c.failedCount > max.failedCount ? c : max, byCampaign[0])
              : null
          }
        }
      }
    })
  } catch (error) {
    console.error('获取失败邮件列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取失败邮件列表失败' },
      { status: 500 }
    )
  }
}

// 批量操作失败邮件
export async function POST(request: NextRequest) {
  try {
    // 验证用户会话
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    console.log('失败邮件批量操作API - 用户ID:', userId);

    const { action, emailIds, recipientIds } = await request.json()

    switch (action) {
      case 'retry':
        // 重试发送
        if (emailIds?.length) {
          await prisma.sentEmail.updateMany({
            where: {
              id: { in: emailIds },
              userId: userId // 确保只能操作自己的邮件
            },
            data: {
              status: 'pending',
              errorMessage: null
            }
          })
        }
        break

      case 'blacklist':
        // 加入黑名单
        if (recipientIds?.length) {
          await prisma.recipient.updateMany({
            where: {
              id: { in: recipientIds },
              userId: userId // 确保只能操作自己的收件人
            },
            data: {
              isBlacklisted: true,
              updatedAt: new Date()
            }
          })
          // 同时更新相关邮件状态
          await prisma.sentEmail.updateMany({
            where: {
              recipientId: { in: recipientIds },
              userId: userId // 确保只能操作自己的邮件
            },
            data: {
              status: 'blacklisted'
            }
          })
        }
        break

      case 'unblacklist':
        // 移出黑名单
        if (recipientIds?.length) {
          await prisma.recipient.updateMany({
            where: {
              id: { in: recipientIds },
              userId: userId // 确保只能操作自己的收件人
            },
            data: {
              isBlacklisted: false,
              updatedAt: new Date()
            }
          })
          // 同时更新相关邮件状态
          await prisma.sentEmail.updateMany({
            where: {
              recipientId: { in: recipientIds },
              userId: userId // 确保只能操作自己的邮件
            },
            data: {
              status: 'failed'
            }
          })
        }
        break

      case 'delete':
        // 删除失败邮件记录
        if (emailIds?.length) {
          await prisma.sentEmail.deleteMany({
            where: {
              id: { in: emailIds },
              userId: userId // 确保只能删除自己的邮件
            }
          })
        }
        break

      default:
        return NextResponse.json(
          { success: false, error: '不支持的操作' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: '操作完成'
    })
  } catch (error) {
    console.error('批量操作失败邮件失败:', error)
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    )
  }
}