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
      clickedAt: {
        not: null
      },
      sentAt: {
        gte: startDate
      }
    }

    if (campaignId) {
      whereCondition.campaignId = campaignId
    }

    // 获取所有点击的邮件
    const clickedEmails = await prisma.sentEmail.findMany({
      where: whereCondition,
      include: {
        campaign: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        clickedAt: 'desc'
      }
    })

    // 从用户画像服务获取详细的点击数据
    const userInteractions = await prisma.userInteraction.findMany({
      where: {
        type: 'EMAIL_CLICKED',
        sentEmailId: {
          in: clickedEmails.map(email => email.id)
        },
        timestamp: {
          gte: startDate
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    })

    // 统计链接点击情况
    const linkStats = userInteractions.reduce((acc, interaction) => {
      const details = interaction.details as any
      const clickedUrl = details?.clickedUrl || 'Unknown Link'
      
      if (!acc[clickedUrl]) {
        acc[clickedUrl] = {
          url: clickedUrl,
          clicks: 0,
          uniqueClicks: new Set(),
          campaigns: new Set(),
          devices: {
            desktop: 0,
            mobile: 0,
            tablet: 0
          },
          clickTimes: []
        }
      }
      
      acc[clickedUrl].clicks++
      
      // 找到对应的邮件和活动
      const email = clickedEmails.find(e => e.id === interaction.sentEmailId)
      if (email) {
        acc[clickedUrl].uniqueClicks.add(email.recipientEmail)
      }
      if (email?.campaign?.name) {
        acc[clickedUrl].campaigns.add(email.campaign.name)
      }
      
      // 统计设备类型
      const deviceType = interaction.deviceType || 'desktop';
      const devices = acc[clickedUrl].devices;
      if (deviceType === 'desktop') {
        devices.desktop++;
      } else if (deviceType === 'mobile') {
        devices.mobile++;
      } else if (deviceType === 'tablet') {
        devices.tablet++;
      } else {
        devices.desktop++;
      }
      
      // 记录点击时间
      acc[clickedUrl].clickTimes.push(interaction.timestamp)
      
      return acc
    }, {} as Record<string, any>)

    // 转换为数组并计算最终统计
    const linkClickStats = Object.values(linkStats).map((stat: any) => ({
      url: stat.url,
      totalClicks: stat.clicks,
      uniqueClicks: stat.uniqueClicks.size,
      campaigns: Array.from(stat.campaigns),
      devices: stat.devices,
      firstClick: stat.clickTimes.length > 0 ? new Date(Math.min(...stat.clickTimes.map((t: Date) => t.getTime()))) : null,
      lastClick: stat.clickTimes.length > 0 ? new Date(Math.max(...stat.clickTimes.map((t: Date) => t.getTime()))) : null
    })).sort((a, b) => b.totalClicks - a.totalClicks)

    // 按活动统计点击情况
    const campaignClickStats = clickedEmails.reduce((acc, email) => {
      const campaignName = email.campaign?.name || 'Unknown Campaign'
      if (!acc[campaignName]) {
        acc[campaignName] = {
          totalEmails: 0,
          clickedEmails: 0,
          totalClicks: 0,
          uniqueRecipients: new Set()
        }
      }
      
      acc[campaignName].clickedEmails++
      acc[campaignName].uniqueRecipients.add(email.recipientEmail)
      
      // 计算该邮件的点击次数
      const emailClicks = userInteractions.filter(i => i.sentEmailId === email.id).length
      acc[campaignName].totalClicks += emailClicks
      
      return acc
    }, {} as Record<string, any>)

    // 获取每个活动的总邮件数
    for (const campaignName of Object.keys(campaignClickStats)) {
      const totalEmails = await prisma.sentEmail.count({
        where: {
          userId: session.user.id,
          campaign: {
            name: campaignName
          },
          sentAt: {
            gte: startDate
          }
        }
      })
      
      campaignClickStats[campaignName].totalEmails = totalEmails
      campaignClickStats[campaignName].clickRate = totalEmails > 0 
        ? (campaignClickStats[campaignName].clickedEmails / totalEmails * 100).toFixed(2)
        : '0.00'
      campaignClickStats[campaignName].uniqueRecipients = campaignClickStats[campaignName].uniqueRecipients.size
    }

    // 按日期统计点击趋势
    const dailyClickStats = userInteractions.reduce((acc, interaction) => {
      const date = interaction.timestamp.toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = {
          clicks: 0,
          uniqueEmails: new Set()
        }
      }
      
      acc[date].clicks++
      const email = clickedEmails.find(e => e.id === interaction.sentEmailId)
        if (email) {
          acc[date].uniqueEmails.add(email.recipientEmail)
        }
      
      return acc
    }, {} as Record<string, any>)

    // 转换日期统计
    Object.keys(dailyClickStats).forEach(date => {
      dailyClickStats[date].uniqueEmails = dailyClickStats[date].uniqueEmails.size
    })

    return NextResponse.json({
      summary: {
        totalClicks: userInteractions.length,
        uniqueLinks: linkClickStats.length,
        uniqueRecipients: new Set(userInteractions.map(i => {
          const email = clickedEmails.find(e => e.id === i.sentEmailId)
          return email?.recipientEmail
        }).filter(Boolean)).size,
        topLink: linkClickStats[0] || null
      },
      linkStats: linkClickStats,
      campaignStats: campaignClickStats,
      dailyStats: dailyClickStats,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Failed to get link click statistics:', error)
    return NextResponse.json(
      { error: 'Failed to get link click statistics' },
      { status: 500 }
    )
  }
}