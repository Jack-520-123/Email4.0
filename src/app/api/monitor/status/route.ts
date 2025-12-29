import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEmailMonitorManager } from '@/lib/email-monitor'
import { prisma } from '@/lib/prisma'

// 强制动态渲染
export const dynamic = 'force-dynamic'

const monitorManager = getEmailMonitorManager()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const detailed = searchParams.get('detailed') === 'true'

    // 获取监听器状态
    const monitorStatus = monitorManager.getStatus()

    // 获取用户的邮件配置
    const emailProfiles = await prisma.emailProfile.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        enableMonitoring: true,
        imapServer: true,
        imapPort: true,
        imapSecure: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // 基础统计
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 邮件发送统计
    const sentEmailStats = await prisma.sentEmail.aggregate({
      where: {
        userId: session.user.id
      },
      _count: {
        id: true
      }
    })

    const recentSentEmails = await prisma.sentEmail.count({
      where: {
        userId: session.user.id,
        sentAt: {
          gte: twentyFourHoursAgo
        }
      }
    })

    const weeklySentEmails = await prisma.sentEmail.count({
      where: {
        userId: session.user.id,
        sentAt: {
          gte: sevenDaysAgo
        }
      }
    })

    // 邮件回复统计
    const replyStats = await prisma.emailReply.aggregate({
      where: {
        emailProfile: {
          userId: session.user.id
        }
      },
      _count: {
        id: true
      }
    })

    const recentReplies = await prisma.emailReply.count({
      where: {
        emailProfile: {
          userId: session.user.id
        },
        receivedAt: {
          gte: twentyFourHoursAgo
        }
      }
    })

    const weeklyReplies = await prisma.emailReply.count({
      where: {
        emailProfile: {
          userId: session.user.id
        },
        receivedAt: {
          gte: sevenDaysAgo
        }
      }
    })

    // 获取最近的邮件活动
    const lastSentEmail = await prisma.sentEmail.findFirst({
      where: {
        userId: session.user.id
      },
      orderBy: {
        sentAt: 'desc'
      },
      select: {
        sentAt: true,
        recipientEmail: true,
        subject: true,
        status: true
      }
    })

    const lastReply = await prisma.emailReply.findFirst({
      where: {
        emailProfile: {
          userId: session.user.id
        }
      },
      orderBy: {
        receivedAt: 'desc'
      },
      select: {
        receivedAt: true,
        from: true,
        subject: true
      }
    })

    // 监听器健康状态检查
    const enabledProfiles = emailProfiles.filter(p => p.enableMonitoring && p.imapServer)
    const activeMonitors = monitorStatus.monitors || []
    const monitorHealth = {
      configuredProfiles: enabledProfiles.length,
      activeMonitors: activeMonitors.length,
      healthStatus: activeMonitors.length === enabledProfiles.length ? 'healthy' : 'warning'
    }

    const basicResponse = {
      monitor: {
        isRunning: monitorStatus.isRunning,
        monitorCount: monitorStatus.monitorCount,
        health: monitorHealth
      },
      statistics: {
        sent: {
          total: sentEmailStats._count.id,
          last24h: recentSentEmails,
          last7d: weeklySentEmails
        },
        replies: {
          total: replyStats._count.id,
          last24h: recentReplies,
          last7d: weeklyReplies
        },
        replyRate: sentEmailStats._count.id > 0 
          ? ((replyStats._count.id / sentEmailStats._count.id) * 100).toFixed(2)
          : '0.00'
      },
      lastActivity: {
        lastSent: lastSentEmail,
        lastReply: lastReply
      },
      profiles: {
        total: emailProfiles.length,
        enabled: enabledProfiles.length,
        configured: enabledProfiles.length
      }
    }

    if (!detailed) {
      return NextResponse.json({
        success: true,
        data: basicResponse
      })
    }

    // 详细信息
    const detailedStats = {
      ...basicResponse,
      detailed: {
        monitors: activeMonitors,
        profiles: emailProfiles,
        recentActivity: {
          sentEmails: await prisma.sentEmail.findMany({
            where: {
              userId: session.user.id,
              sentAt: {
                gte: twentyFourHoursAgo
              }
            },
            orderBy: {
              sentAt: 'desc'
            },
            take: 10,
            select: {
              id: true,
              recipientEmail: true,
              subject: true,
              status: true,
              sentAt: true,
              openedAt: true,
              clickedAt: true,
              messageId: true
            }
          }),
          replies: await prisma.emailReply.findMany({
            where: {
              emailProfile: {
                userId: session.user.id
              },
              receivedAt: {
                gte: twentyFourHoursAgo
              }
            },
            orderBy: {
              receivedAt: 'desc'
            },
            take: 10,
            select: {
              id: true,
              from: true,
              subject: true,
              receivedAt: true,
              sentEmailId: true
            }
          })
        },
        messageIdCoverage: {
          totalSent: sentEmailStats._count.id,
          withMessageId: await prisma.sentEmail.count({
            where: {
              userId: session.user.id,
              messageId: {
                not: null
              }
            }
          }),
          coverage: '0.00'
        }
      }
    }

    // 计算 messageId 覆盖率
    const messageIdCoverage = detailedStats.detailed.messageIdCoverage
    messageIdCoverage.coverage = messageIdCoverage.totalSent > 0 
      ? ((messageIdCoverage.withMessageId / messageIdCoverage.totalSent) * 100).toFixed(2)
      : '0.00'

    return NextResponse.json({
      success: true,
      data: detailedStats
    })

  } catch (error) {
    console.error('获取监听状态失败:', error)
    return NextResponse.json(
      { 
        error: '获取监听状态失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}