import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const historyId = params.id

    // 验证发送历史记录是否属于当前用户（这里的historyId实际上是campaignId）
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: historyId,
        userId: session.user.id
      },
      include: {
        template: {
          select: {
            name: true,
            subject: true
          }
        },
        emailProfile: {
          select: {
            nickname: true
          }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '发送活动不存在' }, { status: 404 })
    }

    // 获取该活动的所有邮件发送记录
    const emailLogs = await prisma.sentEmail.findMany({
      where: {
        campaignId: historyId
      },
      include: {
        recipient: {
          select: {
            email: true,
            name: true
          }
        }
      },
      orderBy: {
        sentAt: 'desc'
      }
    })

    // 统计信息
    const stats = {
      total: emailLogs.length,
      sent: emailLogs.filter(log => log.status === 'sent').length,
      delivered: emailLogs.filter(log => log.status === 'delivered').length,
      failed: emailLogs.filter(log => log.status === 'failed').length,
      bounced: emailLogs.filter(log => log.status === 'bounced').length,
      opened: emailLogs.filter(log => log.status === 'opened').length,
      clicked: emailLogs.filter(log => log.status === 'clicked').length
    }

    // 格式化邮件日志
    const formattedLogs = emailLogs.map(log => ({
      id: log.id,
      recipientEmail: log.recipient?.email || log.recipientEmail,
      recipientName: log.recipient?.name || log.recipientName,
      status: log.status,
      sentAt: log.sentAt?.toISOString(),
      deliveredAt: log.deliveredAt?.toISOString(),
      openedAt: log.openedAt?.toISOString(),
      clickedAt: log.clickedAt?.toISOString(),
      errorMessage: log.errorMessage
    }))

    return NextResponse.json({
      history: {
        id: campaign.id,
        templateName: campaign.template?.name || '',
        subject: campaign.template?.subject || '',
        campaignName: campaign.name,
        sentAt: campaign.createdAt.toISOString(),
        status: campaign.status,
        emailProfileName: campaign.emailProfile?.nickname || ''
      },
      stats,
      logs: formattedLogs
    })
  } catch (error) {
    console.error('获取发送详情失败:', error)
    return NextResponse.json(
      { error: '获取发送详情失败' },
      { status: 500 }
    )
  }
}