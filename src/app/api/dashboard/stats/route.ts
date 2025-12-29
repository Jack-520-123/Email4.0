import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = parseFloat(searchParams.get('timeRange') || '30')
    const senderId = searchParams.get('senderId') || 'all'

    const startDate = new Date()
    if (timeRange < 1) {
      // 小时级别的时间范围
      const hoursAgo = timeRange * 24
      startDate.setHours(startDate.getHours() - hoursAgo)
    } else {
      // 天级别的时间范围
      startDate.setDate(startDate.getDate() - timeRange)
    }
    
    // 构建查询条件
    const whereCondition: any = {
      userId: currentUser.id,
      sentAt: { gte: startDate },
    }
    
    // 如果选择了特定发件人，添加筛选条件
    if (senderId !== 'all') {
      whereCondition.emailProfileId = senderId
    }

    // 基础统计
    const sentEmails = await prisma.sentEmail.findMany({
      where: whereCondition,
      select: {
        id: true,
        status: true,
        sentAt: true,
        templateId: true,
        recipientEmail: true,
      },
    })

    const totalSent = sentEmails.length
    const totalDelivered = sentEmails.filter(e => e.status === 'delivered' || e.status === 'opened' || e.status === 'clicked').length
    const totalOpened = sentEmails.filter(e => e.status === 'opened' || e.status === 'clicked').length
    const totalClicked = sentEmails.filter(e => e.status === 'clicked').length
    const totalBounced = sentEmails.filter(e => e.status === 'bounced' || e.status === 'failed').length
    const totalFailed = sentEmails.filter(e => e.status === 'failed').length
    const totalRejected = sentEmails.filter(e => e.status === 'rejected').length
    
    // 发送成功数量：排除失败、退回、拒绝等状态的邮件
    const totalSuccessfullySent = sentEmails.filter(e => 
      e.status !== 'failed' && 
      e.status !== 'bounced' && 
      e.status !== 'rejected' && 
      e.status !== 'invalid' && 
      e.status !== 'blacklisted'
    ).length

    // 链接点击统计
    const clickedEmails = sentEmails.filter(e => e.status === 'clicked')
    const uniqueClicks = new Set(clickedEmails.map(e => e.recipientEmail)).size

    // 计算成功发送量（排除失败、退回、拒绝等状态）
    const successfulSent = totalSent - totalFailed - totalBounced - totalRejected
    
    // 计算各种率
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0
    const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0
    const failureRate = totalSent > 0 ? ((totalFailed + totalBounced + totalRejected) / totalSent) * 100 : 0

    const totalRecipients = await prisma.recipient.count({
      where: { userId: currentUser.id },
    })

    const totalTemplates = await prisma.template.count({
      where: { userId: currentUser.id },
    })

    // 回复统计
    const replyWhereCondition: any = {
      emailProfile: {
        userId: currentUser.id,
      },
    }

    if (senderId !== 'all') {
      replyWhereCondition.emailProfileId = senderId
    }

    const totalReplies = await prisma.emailReply.count({
      where: replyWhereCondition,
    })

    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    const repliesLast24h = await prisma.emailReply.count({
      where: {
        ...replyWhereCondition,
        createdAt: { gte: twentyFourHoursAgo },
      },
    })

    const repliesInRange = await prisma.emailReply.count({
      where: {
        ...replyWhereCondition,
        createdAt: { gte: startDate },
      },
    })

    const enabledMonitoringProfiles = await prisma.emailProfile.count({
      where: {
        userId: currentUser.id,
        enableMonitoring: true,
        imapServer: { not: null },
      },
    })

    // 计算回复率
    const replyRate = successfulSent > 0 ? (repliesInRange / successfulSent) * 100 : 0

    // 失败邮箱统计 - 基于 SentEmail 表（修复状态值匹配问题 - 支持大小写状态值）
    const failedEmailsStats = await prisma.sentEmail.groupBy({
      by: ['status'],
      where: {
        userId: currentUser.id,
        status: {
          in: [
            'failed', 'bounced', 'rejected', 'invalid', 'blacklisted',
            'FAILED', 'BOUNCED', 'REJECTED', 'INVALID', 'BLACKLISTED'
          ]
        },
        sentAt: { gte: startDate },
        ...(senderId !== 'all' ? { emailProfileId: senderId } : {})
      },
      _count: {
        id: true
      }
    })

    // 黑名单收件人统计
    const blacklistedCount = await prisma.recipient.count({
      where: {
        userId: currentUser.id,
        isBlacklisted: true
      }
    })

    // 总失败邮件数量
    const totalFailedEmails = failedEmailsStats.reduce((sum, stat) => sum + stat._count.id, 0)

    // 失败邮箱详细统计（修复状态值匹配 - 支持大小写状态值）
    const failedEmailsBreakdown = {
      total: totalFailedEmails,
      failed: (failedEmailsStats.find(s => s.status === 'failed')?._count.id || 0) + 
              (failedEmailsStats.find(s => s.status === 'FAILED')?._count.id || 0),
      bounced: (failedEmailsStats.find(s => s.status === 'bounced')?._count.id || 0) + 
               (failedEmailsStats.find(s => s.status === 'BOUNCED')?._count.id || 0),
      rejected: (failedEmailsStats.find(s => s.status === 'rejected')?._count.id || 0) + 
                (failedEmailsStats.find(s => s.status === 'REJECTED')?._count.id || 0),
      invalid: (failedEmailsStats.find(s => s.status === 'invalid')?._count.id || 0) + 
               (failedEmailsStats.find(s => s.status === 'INVALID')?._count.id || 0),
      blacklisted: (failedEmailsStats.find(s => s.status === 'blacklisted')?._count.id || 0) + 
                   (failedEmailsStats.find(s => s.status === 'BLACKLISTED')?._count.id || 0),
      blacklistedRecipients: blacklistedCount
    }

    // 邮件活动数据
    const emailActivityData = Array.from({ length: timeRange }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return { name: d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }), sent: 0, delivered: 0, opened: 0, clicked: 0 }
    }).reverse()

    const dateMap = new Map(emailActivityData.map((d, i) => [d.name, i]))

    for (const email of sentEmails) {
      const dateStr = new Date(email.sentAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
      if (dateMap.has(dateStr)) {
        const index = dateMap.get(dateStr)!
        emailActivityData[index].sent++
        if (email.status === 'delivered' || email.status === 'opened' || email.status === 'clicked') emailActivityData[index].delivered++
        if (email.status === 'opened' || email.status === 'clicked') emailActivityData[index].opened++
        if (email.status === 'clicked') emailActivityData[index].clicked++
      }
    }

    // 状态分布
    const statusDistribution = [
      { name: '已送达', value: totalDelivered, color: '#10b981' },
      { name: '已打开', value: totalOpened, color: '#3b82f6' },
      { name: '已点击', value: totalClicked, color: '#f59e0b' },
      { name: '退回', value: totalBounced, color: '#ef4444' },
    ]

    // 模板统计
    const templateUsage = await prisma.sentEmail.groupBy({
      by: ['templateId'],
      where: {
        ...whereCondition,
        templateId: { not: null },
      },
      _count: {
        templateId: true,
      },
      orderBy: {
        _count: {
          templateId: 'desc',
        },
      },
      take: 5,
    })

    const templateIds = templateUsage.map(t => t.templateId!)
    const templatesInfo = await prisma.template.findMany({
      where: { id: { in: templateIds } },
      select: { id: true, name: true },
    })
    const templateMap = new Map(templatesInfo.map(t => [t.id, t.name]))

    const templateStats = templateUsage.map(t => ({
      name: templateMap.get(t.templateId!) || '未知模板',
      sent: t._count.templateId,
    }))

    // 回复内容词云数据
    const replyWordCloudData = await prisma.emailReply.findMany({
      where: {
        emailProfile: {
          userId: currentUser.id
        },
        createdAt: {
          gte: startDate
        }
      },
      select: {
        body: true,
        subject: true
      },
      take: 100
    })

    // 处理词云数据
    const wordFrequency: Record<string, number> = {}
    const stopWords = new Set(['的', '了', '是', '在', '我', '你', '他', '她', '它', '们', '这', '那', '有', '和', '与', '或', '但', '如果', '因为', '所以', '然后', '可以', '能够', '应该', '需要', '希望', '想要', '感谢', '谢谢', '请', '您', '先生', '女士', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'])
    
    replyWordCloudData.forEach(reply => {
      const text = (reply.body + ' ' + reply.subject).toLowerCase()
      // 简单的分词处理
      const words = text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || []
      words.forEach(word => {
        if (word.length > 1 && !stopWords.has(word)) {
          wordFrequency[word] = (wordFrequency[word] || 0) + 1
        }
      })
    })

    const wordCloudData = Object.entries(wordFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([word, count]) => ({ text: word, value: count }))

    // 邮件发送时间分布统计
    const hourlyDistribution = await prisma.sentEmail.groupBy({
      by: ['sentAt'],
      where: {
        ...whereCondition
      },
      _count: {
        id: true
      }
    })

    // 按小时统计
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
    hourlyDistribution.forEach(item => {
      const hour = new Date(item.sentAt).getHours()
      hourlyStats[hour].count += item._count.id
    })

    // 邮件状态趋势数据
    const statusTrendData = await prisma.sentEmail.findMany({
      where: whereCondition,
      select: {
        sentAt: true,
        status: true
      },
      orderBy: {
        sentAt: 'asc'
      }
    })

    // 按日期分组统计状态
    const dailyStatusMap: Record<string, Record<string, number>> = {}
    statusTrendData.forEach(email => {
      const date = email.sentAt.toISOString().split('T')[0]
      if (!dailyStatusMap[date]) {
        dailyStatusMap[date] = {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          failed: 0
        }
      }
      
      // 统计发送总数
      dailyStatusMap[date].sent++
      
      // 根据状态统计各项指标
      const status = email.status || 'unknown'
      if (status === 'delivered' || status === 'opened' || status === 'clicked') {
        dailyStatusMap[date].delivered++
      }
      if (status === 'opened' || status === 'clicked') {
        dailyStatusMap[date].opened++
      }
      if (status === 'clicked') {
        dailyStatusMap[date].clicked++
      }
      if (status === 'bounced') {
        dailyStatusMap[date].bounced++
      }
      if (status === 'failed') {
        dailyStatusMap[date].failed++
      }
    })

    // 计算状态趋势数据（百分比）
    const statusTrend = Object.entries(dailyStatusMap)
      .map(([date, stats]) => {
        const sent = stats.sent || 0
        const delivered = stats.delivered || 0
        const opened = stats.opened || 0
        
        return {
          date: new Date(date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
          deliveryRate: sent > 0 ? parseFloat(((delivered / sent) * 100).toFixed(2)) : 0,
          openRate: delivered > 0 ? parseFloat(((opened / delivered) * 100).toFixed(2)) : 0,
          clickRate: opened > 0 ? parseFloat(((stats.clicked / opened) * 100).toFixed(2)) : 0,
          sent,
          delivered,
          opened,
          clicked: stats.clicked || 0
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter(item => item.sent > 0) // 只显示有发送数据的日期

    // 最近活动 - 合并发送和回复活动
    const recentSentEmails = await prisma.sentEmail.findMany({
        where: senderId !== 'all' ? { userId: currentUser.id, emailProfileId: senderId } : { userId: currentUser.id },
        orderBy: { sentAt: 'desc' },
        take: 3,
        select: { id: true, recipientEmail: true, sentAt: true, status: true },
    });

    const recentReplies = await prisma.emailReply.findMany({
      where: senderId !== 'all' ? { emailProfileId: senderId } : { emailProfile: { userId: currentUser.id } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, from: true, createdAt: true, subject: true },
    });

    const sentActivities = recentSentEmails.map(e => ({
      id: `sent-${e.id}`,
      action: `向 ${e.recipientEmail} 发送邮件`,
      time: new Date(e.sentAt).toLocaleString('zh-CN'),
      status: e.status,
      type: 'sent',
      timestamp: e.sentAt
    }));

    const replyActivities = recentReplies.map(r => ({
      id: `reply-${r.id}`,
      action: `收到来自 ${r.from} 的回复`,
      time: new Date(r.createdAt).toLocaleString('zh-CN'),
      subject: r.subject,
      type: 'reply',
      timestamp: r.createdAt
    }));

    const recentActivity = [...sentActivities, ...replyActivities]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);

    const replyWords = [];

    return NextResponse.json({
      stats: {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalFailed,
        totalRejected,
        totalRecipients,
        totalTemplates,
        totalReplies,
        repliesLast24h,
        repliesInRange,
        enabledMonitoringProfiles,
        blacklistedCount,
        uniqueClicks,
        deliveryRate: parseFloat(deliveryRate.toFixed(2)),
        openRate: parseFloat(openRate.toFixed(2)),
        clickRate: parseFloat(clickRate.toFixed(2)),
        failureRate: parseFloat(failureRate.toFixed(2)),
        replyRate: parseFloat(replyRate.toFixed(2)),
        // 失败邮箱统计
        failedEmails: failedEmailsBreakdown
      },
      emailActivityData,
      statusDistribution,
      templateStats,
      recentActivity,
      wordCloudData,
      hourlyStats,
      statusTrend,
    })

  } catch (error) {
    console.error('获取仪表板数据失败:', error)
    if (error instanceof Error) {
        return NextResponse.json({ error: '内部服务器错误', details: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}