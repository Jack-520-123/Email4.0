import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 获取数据分析统计
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 获取当前用户信息
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = parseFloat(searchParams.get('days') || '7')
    
    const startDate = new Date()
    if (timeRange < 1) {
      // 小时级别的时间范围
      const hoursAgo = timeRange * 24
      startDate.setHours(startDate.getHours() - hoursAgo)
    } else {
      // 天级别的时间范围
      startDate.setDate(startDate.getDate() - timeRange)
    }

    // 获取基础统计数据
    const [totalSent, totalDelivered, totalOpened, totalClicked, totalRecipients, totalTemplates, totalReplies] = await Promise.all([
      prisma.sentEmail.count({
        where: {
          userId: currentUser.id,
          sentAt: { gte: startDate }
        }
      }),
      prisma.sentEmail.count({
        where: {
          userId: currentUser.id,
          status: 'delivered',
          sentAt: { gte: startDate }
        }
      }),
      prisma.sentEmail.count({
        where: {
          userId: currentUser.id,
          status: 'opened',
          sentAt: { gte: startDate }
        }
      }),
      prisma.sentEmail.count({
        where: {
          userId: currentUser.id,
          status: 'clicked',
          sentAt: { gte: startDate }
        }
      }),
      prisma.recipient.count({
        where: {
          userId: currentUser.id
        }
      }),
      prisma.template.count({
        where: {
          userId: currentUser.id
        }
      }),
      prisma.emailReply.count({
        where: {
          userId: currentUser.id,
          receivedAt: { gte: startDate }
        }
      })
    ])

    // 获取每日发送趋势
    const dailyStats = await prisma.$queryRaw`
      SELECT 
        DATE(sent_at) as date,
        COUNT(*) as sent,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'opened' THEN 1 END) as opened,
        COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked
      FROM "SentEmail"
      WHERE user_id = ${currentUser.id}
        AND sent_at >= ${startDate}
      GROUP BY DATE(sent_at)
      ORDER BY DATE(sent_at)
    ` as Array<{ date: Date; sent: bigint; delivered: bigint; opened: bigint; clicked: bigint }>

    // 获取模板使用统计
    const templateStats = await prisma.sentEmail.groupBy({
      by: ['templateId'],
      where: {
        userId: currentUser.id,
        sentAt: { gte: startDate }
      },
      _count: {
        templateId: true
      },
      orderBy: {
        _count: {
          templateId: 'desc'
        }
      },
      take: 10
    })

    // 获取模板名称
    const templateIds = templateStats.map(stat => stat.templateId).filter(Boolean)
    const templates = await prisma.template.findMany({
      where: {
        id: { in: templateIds as string[] }
      },
      select: {
        id: true,
        name: true
      }
    })

    const templateStatsWithNames = templateStats.map(stat => {
      const template = templates.find(t => t.id === stat.templateId)
      return {
        templateId: stat.templateId,
        templateName: template?.name || '未知模板',
        count: stat._count.templateId,
        totalRecipients: stat._count.templateId || 0
      }
    })

    // 获取发送状态分布
    const statusStats = await prisma.sentEmail.groupBy({
      by: ['status'],
      where: {
        userId: currentUser.id,
        sentAt: { gte: startDate }
      },
      _count: {
        status: true
      }
    })

    // 计算转换率
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent * 100).toFixed(2) : '0'
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered * 100).toFixed(2) : '0'
    const clickRate = totalOpened > 0 ? (totalClicked / totalOpened * 100).toFixed(2) : '0'

    return NextResponse.json({
      summary: {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalRecipients,
        totalTemplates,
        totalReplies,
        deliveryRate: parseFloat(deliveryRate),
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate)
      },
      dailyStats,
      templateStats: templateStatsWithNames,
      statusStats,
      period: {
        days: timeRange,
        startDate,
        endDate: new Date()
      }
    })
  } catch (error) {
    console.error('获取数据分析失败:', error)
    return NextResponse.json({ error: '获取数据分析失败' }, { status: 500 })
  }
}