import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 强制动态渲染
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const days = parseInt(searchParams.get('days') || '30')
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 构建查询条件
    const whereCondition: any = {
      userId: session.user.id,
      sentAt: {
        gte: startDate
      }
    }

    if (campaignId) {
      whereCondition.campaignId = campaignId
    }

    // 获取发送邮件统计
    const sentEmails = await prisma.sentEmail.findMany({
      where: whereCondition,
      include: {
        replies: true,
        campaign: {
          select: {
            name: true
          }
        }
      }
    })

    // 计算统计数据
    const totalSent = sentEmails.length
    const totalOpened = sentEmails.filter(email => email.openedAt).length
    const totalClicked = sentEmails.filter(email => email.clickedAt).length
    const totalReplied = sentEmails.filter(email => email.replies.length > 0).length
    const totalBounced = sentEmails.filter(email => email.bouncedAt).length

    // 计算率
    const openRate = totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(2) : '0.00'
    const clickRate = totalSent > 0 ? (totalClicked / totalSent * 100).toFixed(2) : '0.00'
    const replyRate = totalSent > 0 ? (totalReplied / totalSent * 100).toFixed(2) : '0.00'
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent * 100).toFixed(2) : '0.00'
    const clickThroughRate = totalOpened > 0 ? (totalClicked / totalOpened * 100).toFixed(2) : '0.00'

    // 按活动分组统计
    const campaignStats = sentEmails.reduce((acc, email) => {
      const campaignName = email.campaign?.name || '未知活动'
      if (!acc[campaignName]) {
        acc[campaignName] = {
          sent: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
          bounced: 0
        }
      }
      
      acc[campaignName].sent++
      if (email.openedAt) acc[campaignName].opened++
      if (email.clickedAt) acc[campaignName].clicked++
      if (email.replies.length > 0) acc[campaignName].replied++
      if (email.bouncedAt) acc[campaignName].bounced++
      
      return acc
    }, {} as Record<string, any>)

    // 计算每个活动的率
    Object.keys(campaignStats).forEach(campaignName => {
      const stats = campaignStats[campaignName]
      stats.openRate = stats.sent > 0 ? (stats.opened / stats.sent * 100).toFixed(2) : '0.00'
      stats.clickRate = stats.sent > 0 ? (stats.clicked / stats.sent * 100).toFixed(2) : '0.00'
      stats.replyRate = stats.sent > 0 ? (stats.replied / stats.sent * 100).toFixed(2) : '0.00'
      stats.bounceRate = stats.sent > 0 ? (stats.bounced / stats.sent * 100).toFixed(2) : '0.00'
      stats.clickThroughRate = stats.opened > 0 ? (stats.clicked / stats.opened * 100).toFixed(2) : '0.00'
    })

    // 按日期统计趋势
    const dailyStats = sentEmails.reduce((acc, email) => {
      const date = email.sentAt.toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = {
          sent: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
          bounced: 0
        }
      }
      
      acc[date].sent++
      if (email.openedAt) acc[date].opened++
      if (email.clickedAt) acc[date].clicked++
      if (email.replies.length > 0) acc[date].replied++
      if (email.bouncedAt) acc[date].bounced++
      
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      summary: {
        totalSent,
        totalOpened,
        totalClicked,
        totalReplied,
        totalBounced,
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        replyRate: parseFloat(replyRate),
        bounceRate: parseFloat(bounceRate),
        clickThroughRate: parseFloat(clickThroughRate)
      },
      campaignStats,
      dailyStats,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('获取邮件统计失败:', error)
    return NextResponse.json(
      { error: '获取邮件统计失败' },
      { status: 500 }
    )
  }
}