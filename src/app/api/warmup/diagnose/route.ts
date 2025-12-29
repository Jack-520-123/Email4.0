import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

// 邮件预热诊断API
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json({ error: '缺少活动ID' }, { status: 400 })
    }

    // 获取预热活动信息
    const campaign = await prisma.warmupCampaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id,
      },
      include: {
        emailProfiles: true,
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '预热活动不存在' }, { status: 404 })
    }

    const diagnostics = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        emailProfilesCount: campaign.emailProfiles.length,
        minSendDelay: campaign.minSendDelay,
        maxSendDelay: campaign.maxSendDelay,
      },
      emailProfiles: [] as any[],
      issues: [] as string[],
      recommendations: [] as string[]
    }

    // 检查邮箱配置
    if (campaign.emailProfiles.length < 2) {
      diagnostics.issues.push('预热活动至少需要2个邮箱配置')
      diagnostics.recommendations.push('请添加更多邮箱配置到预热活动中')
    }

    // 测试每个邮箱的SMTP连接
    for (const profile of campaign.emailProfiles) {
      const profileDiagnostic = {
        id: profile.id,
        email: profile.email,
        smtpServer: profile.smtpServer,
        smtpPort: profile.smtpPort,
        connectionTest: 'pending' as 'success' | 'failed' | 'pending',
        error: null as string | null
      }

      try {
        // 创建SMTP传输器并测试连接
        const transporter = nodemailer.createTransport({
          host: profile.smtpServer,
          port: profile.smtpPort,
          secure: profile.smtpPort === 465,
          auth: {
            user: profile.email,
            pass: profile.password,
          },
          connectionTimeout: 10000, // 10秒超时
          greetingTimeout: 10000,
        })

        await transporter.verify()
        profileDiagnostic.connectionTest = 'success'
      } catch (error) {
        profileDiagnostic.connectionTest = 'failed'
        profileDiagnostic.error = error instanceof Error ? error.message : String(error)
        diagnostics.issues.push(`邮箱 ${profile.email} SMTP连接失败: ${profileDiagnostic.error}`)
        diagnostics.recommendations.push(`检查邮箱 ${profile.email} 的SMTP设置和密码`)
      }

      diagnostics.emailProfiles.push(profileDiagnostic)
    }

    // 检查预热日志
    const recentLogs = await prisma.warmupLog.findMany({
      where: {
        warmupCampaignId: campaignId,
        sentAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
        }
      },
      orderBy: {
        sentAt: 'desc'
      },
      take: 10
    })

    const successCount = recentLogs.filter(log => log.status === 'success').length
    const failedCount = recentLogs.filter(log => log.status === 'failed').length

    if (failedCount > successCount) {
      diagnostics.issues.push('最近24小时内失败邮件数量超过成功邮件')
      diagnostics.recommendations.push('检查邮箱配置和网络连接')
    }

    if (recentLogs.length === 0 && campaign.status === 'active') {
      diagnostics.issues.push('预热活动状态为活跃，但没有发送记录')
      diagnostics.recommendations.push('检查预热任务是否正常启动')
    }

    // 检查全局任务状态
    const globalTasks = global.warmupTasks || new Map()
    const taskInfo = globalTasks.get(campaignId)
    
    const taskStatus = {
      isRunning: taskInfo?.isRunning || false,
      startTime: taskInfo?.startTime || null,
      error: taskInfo?.error || null
    }

    if (campaign.status === 'active' && !taskStatus.isRunning) {
      diagnostics.issues.push('预热活动状态为活跃，但任务未在运行')
      diagnostics.recommendations.push('尝试重新启动预热活动')
    }

    return NextResponse.json({
      ...diagnostics,
      taskStatus,
      recentLogs: recentLogs.map(log => ({
        id: log.id,
        fromEmail: log.fromEmail,
        toEmail: log.toEmail,
        status: log.status,
        error: log.error,
        createdAt: log.sentAt
      })),
      summary: {
        totalIssues: diagnostics.issues.length,
        healthScore: Math.max(0, 100 - (diagnostics.issues.length * 20)),
        lastActivity: recentLogs[0]?.sentAt || null
      }
    })

  } catch (error) {
    console.error('预热诊断失败:', error)
    return NextResponse.json({ error: '诊断失败' }, { status: 500 })
  }
}

// 修复预热问题
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    const { campaignId, action } = await request.json()

    if (!campaignId || !action) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const campaign = await prisma.warmupCampaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id,
      },
      include: {
        emailProfiles: true,
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '预热活动不存在' }, { status: 404 })
    }

    let result = { success: false, message: '' }

    switch (action) {
      case 'restart':
        // 停止现有任务
        const globalTasks = global.warmupTasks || new Map()
        const existingTask = globalTasks.get(campaignId)
        if (existingTask) {
          existingTask.isRunning = false
          globalTasks.delete(campaignId)
        }

        // 重新启动
        await prisma.warmupCampaign.update({
          where: { id: campaignId },
          data: { status: 'active' },
        })

        const taskInfo = {
          isRunning: true,
          startTime: new Date(),
          campaignId,
        }
        
        globalTasks.set(campaignId, taskInfo)

        // 动态导入并启动预热逻辑
        const { processWarmupCampaign } = await import('@/lib/email-warmup')
        processWarmupCampaign(campaignId).catch(error => {
          console.error('预热活动执行失败:', error)
          const task = globalTasks.get(campaignId)
          if (task) {
            task.isRunning = false
            task.error = error.message
          }
        })

        result = { success: true, message: '预热活动已重新启动' }
        break

      case 'test_email':
        // 发送测试邮件
        if (campaign.emailProfiles.length < 2) {
          result = { success: false, message: '至少需要2个邮箱配置才能发送测试邮件' }
          break
        }

        const fromProfile = campaign.emailProfiles[0]
        const toProfile = campaign.emailProfiles[1]

        try {
          const transporter = nodemailer.createTransport({
            host: fromProfile.smtpServer,
            port: fromProfile.smtpPort,
            secure: fromProfile.smtpPort === 465,
            auth: {
              user: fromProfile.email,
              pass: fromProfile.password,
            },
          })

          await transporter.sendMail({
            from: `${fromProfile.nickname} <${fromProfile.email}>`,
            to: toProfile.email,
            subject: '预热测试邮件',
            text: '这是一封预热测试邮件，用于验证邮箱配置是否正确。',
          })

          // 记录测试日志
          await prisma.warmupLog.create({
            data: {
              warmupCampaignId: campaignId,
              fromEmail: fromProfile.email,
              toEmail: toProfile.email,
              subject: '预热测试邮件',
              body: '这是一封预热测试邮件，用于验证邮箱配置是否正确。',
              status: 'success',
            },
          })

          result = { success: true, message: '测试邮件发送成功' }
        } catch (error) {
          await prisma.warmupLog.create({
            data: {
              warmupCampaignId: campaignId,
              fromEmail: fromProfile.email,
              toEmail: toProfile.email,
              subject: '预热测试邮件',
              body: '这是一封预热测试邮件，用于验证邮箱配置是否正确。',
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            },
          })

          result = { success: false, message: `测试邮件发送失败: ${error instanceof Error ? error.message : String(error)}` }
        }
        break

      default:
        result = { success: false, message: '未知的修复操作' }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('修复预热问题失败:', error)
    return NextResponse.json({ error: '修复失败' }, { status: 500 })
  }
}
