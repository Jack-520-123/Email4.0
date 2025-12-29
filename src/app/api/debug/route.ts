import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getEmailMonitorManager } from '@/lib/email-monitor'

// GET /api/debug - 系统诊断和健康检查
export async function GET(request: NextRequest) {
  const diagnostics = {
    database: false,
    emailMonitor: false,
    timestamp: new Date().toISOString(),
    errors: [] as string[]
  }

  try {
    // 测试数据库连接
    try {
      await prisma.$queryRaw`SELECT 1`
      diagnostics.database = true
    } catch (dbError) {
      diagnostics.errors.push(`数据库连接失败: ${dbError instanceof Error ? dbError.message : '未知错误'}`)
    }

    // 测试邮件监听服务
    try {
      const monitorManager = getEmailMonitorManager()
      const status = monitorManager.getStatus()
      diagnostics.emailMonitor = status.isRunning
      if (!status.isRunning) {
        diagnostics.errors.push('邮件监听服务未运行')
      }
    } catch (monitorError) {
      diagnostics.errors.push(`邮件监听服务检查失败: ${monitorError instanceof Error ? monitorError.message : '未知错误'}`)
    }

    // 获取最近的活动
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        template: true,
        emailProfile: true,
        sentEmails: {
          orderBy: { sentAt: 'desc' },
          take: 10
        }
      }
    })

    // 获取邮件发送统计
    const emailStats = await prisma.sentEmail.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    })

    // 获取最近的邮件发送记录
    const recentEmails = await prisma.sentEmail.findMany({
      orderBy: { sentAt: 'desc' },
      take: 20,
      include: {
        campaign: {
          select: {
            name: true,
            status: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      diagnostics,
      database: diagnostics.database,
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        totalRecipients: c.totalRecipients,
        createdAt: c.createdAt,
        lastSentAt: c.lastSentAt,
        emailProfile: c.emailProfile?.nickname,
        sentEmails: c.sentEmails.length
      })),
      emailStats,
      recentEmails: recentEmails.map(e => ({
        id: e.id,
        recipientEmail: e.recipientEmail,
        status: e.status,
        sentAt: e.sentAt,
        errorMessage: e.errorMessage,
        campaign: e.campaign?.name
      }))
    })
  } catch (error) {
    console.error('调试API错误:', error)
    return NextResponse.json(
      { error: '获取调试信息失败' },
      { status: 500 }
    )
  }
}