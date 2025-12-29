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

    const diagnostics = {
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      checks: [] as any[],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    }

    // 检查1: 邮件配置完整性
    const emailProfiles = await prisma.emailProfile.findMany({
      where: {
        userId: session.user.id
      }
    })

    const configCheck = {
      name: '邮件配置检查',
      status: 'passed' as 'passed' | 'failed' | 'warning',
      details: {
        totalProfiles: emailProfiles.length,
        enabledProfiles: emailProfiles.filter(p => p.enableMonitoring).length,
        configuredProfiles: emailProfiles.filter(p => p.imapServer && p.imapPort).length,
        issues: [] as string[]
      }
    }

    if (emailProfiles.length === 0) {
      configCheck.status = 'failed'
      configCheck.details.issues.push('没有配置任何邮件账户')
    } else {
      const enabledProfiles = emailProfiles.filter(p => p.enableMonitoring)
      if (enabledProfiles.length === 0) {
        configCheck.status = 'warning'
        configCheck.details.issues.push('没有启用邮件监听的账户')
      }
      
      const incompleteProfiles = enabledProfiles.filter(p => !p.imapServer || !p.imapPort)
      if (incompleteProfiles.length > 0) {
        configCheck.status = 'failed'
        configCheck.details.issues.push(`${incompleteProfiles.length}个账户的IMAP配置不完整`)
      }
    }

    diagnostics.checks.push(configCheck)

    // 检查2: 监听器运行状态
    const monitorStatus = monitorManager.getStatus()
    const monitorCheck = {
      name: '监听器状态检查',
      status: 'passed' as 'passed' | 'failed' | 'warning',
      details: {
        isRunning: monitorStatus.isRunning,
        monitorCount: monitorStatus.monitorCount,
        expectedCount: emailProfiles.filter(p => p.enableMonitoring && p.imapServer).length,
        issues: [] as string[]
      }
    }

    if (!monitorStatus.isRunning) {
      monitorCheck.status = 'failed'
      monitorCheck.details.issues.push('邮件监听器未运行')
    } else if (monitorCheck.details.monitorCount < monitorCheck.details.expectedCount) {
      monitorCheck.status = 'warning'
      monitorCheck.details.issues.push(`监听器数量不匹配：运行${monitorCheck.details.monitorCount}个，期望${monitorCheck.details.expectedCount}个`)
    }

    diagnostics.checks.push(monitorCheck)

    // 检查3: 数据完整性
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    const sentEmailsCount = await prisma.sentEmail.count({
      where: {
        userId: session.user.id,
        sentAt: {
          gte: twentyFourHoursAgo
        }
      }
    })

    const sentEmailsWithMessageId = await prisma.sentEmail.count({
      where: {
        userId: session.user.id,
        sentAt: {
          gte: twentyFourHoursAgo
        },
        messageId: {
          not: null
        }
      }
    })

    const dataIntegrityCheck = {
      name: '数据完整性检查',
      status: 'passed' as 'passed' | 'failed' | 'warning',
      details: {
        recentSentEmails: sentEmailsCount,
        emailsWithMessageId: sentEmailsWithMessageId,
        messageIdCoverage: sentEmailsCount > 0 ? ((sentEmailsWithMessageId / sentEmailsCount) * 100).toFixed(2) : '0.00',
        issues: [] as string[]
      }
    }

    if (sentEmailsCount > 0 && sentEmailsWithMessageId === 0) {
      dataIntegrityCheck.status = 'failed'
      dataIntegrityCheck.details.issues.push('最近发送的邮件都没有保存Message-ID，回复匹配将失败')
    } else if (sentEmailsCount > 0 && (sentEmailsWithMessageId / sentEmailsCount) < 0.8) {
      dataIntegrityCheck.status = 'warning'
      dataIntegrityCheck.details.issues.push(`Message-ID覆盖率较低(${dataIntegrityCheck.details.messageIdCoverage}%)，可能影响回复匹配准确性`)
    }

    diagnostics.checks.push(dataIntegrityCheck)

    // 检查4: 连接测试
    const connectionCheck = {
      name: 'IMAP连接测试',
      status: 'passed' as 'passed' | 'failed' | 'warning',
      details: {
        testedProfiles: 0,
        successfulConnections: 0,
        failedConnections: 0,
        connectionResults: [] as any[],
        issues: [] as string[]
      }
    }

    const enabledProfiles = emailProfiles.filter(p => p.enableMonitoring && p.imapServer)
    
    for (const profile of enabledProfiles.slice(0, 3)) { // 限制测试数量
      connectionCheck.details.testedProfiles++
      try {
        const success = await monitorManager.testConnection(profile.id)
        if (success) {
          connectionCheck.details.successfulConnections++
          connectionCheck.details.connectionResults.push({
            email: profile.email,
            status: 'success'
          })
        } else {
          connectionCheck.details.failedConnections++
          connectionCheck.details.connectionResults.push({
            email: profile.email,
            status: 'failed',
            error: 'Connection test failed'
          })
        }
      } catch (error) {
        connectionCheck.details.failedConnections++
        connectionCheck.details.connectionResults.push({
          email: profile.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    if (connectionCheck.details.failedConnections > 0) {
      if (connectionCheck.details.successfulConnections === 0) {
        connectionCheck.status = 'failed'
        connectionCheck.details.issues.push('所有IMAP连接测试都失败')
      } else {
        connectionCheck.status = 'warning'
        connectionCheck.details.issues.push(`${connectionCheck.details.failedConnections}个IMAP连接测试失败`)
      }
    }

    diagnostics.checks.push(connectionCheck)

    // 检查5: 最近活动检查
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
        receivedAt: true
      }
    })

    const activityCheck = {
      name: '监听活动检查',
      status: 'passed' as 'passed' | 'failed' | 'warning',
      details: {
        lastReplyTime: lastReply?.receivedAt || null,
        daysSinceLastReply: lastReply 
          ? Math.floor((now.getTime() - lastReply.receivedAt.getTime()) / (1000 * 60 * 60 * 24))
          : null,
        issues: [] as string[]
      }
    }

    if (!lastReply) {
      activityCheck.status = 'warning'
      activityCheck.details.issues.push('从未检测到邮件回复')
    } else if (activityCheck.details.daysSinceLastReply! > 7) {
      activityCheck.status = 'warning'
      activityCheck.details.issues.push(`超过${activityCheck.details.daysSinceLastReply}天没有检测到新回复`)
    }

    diagnostics.checks.push(activityCheck)

    // 计算总结
    diagnostics.summary.total = diagnostics.checks.length
    diagnostics.summary.passed = diagnostics.checks.filter(c => c.status === 'passed').length
    diagnostics.summary.failed = diagnostics.checks.filter(c => c.status === 'failed').length
    diagnostics.summary.warnings = diagnostics.checks.filter(c => c.status === 'warning').length

    // 生成建议
    const recommendations = []
    
    if (diagnostics.summary.failed > 0) {
      recommendations.push('发现严重问题，建议立即修复后重启邮件监听功能')
    }
    
    if (diagnostics.summary.warnings > 0) {
      recommendations.push('发现警告项，建议检查配置并优化设置')
    }
    
    if (diagnostics.summary.failed === 0 && diagnostics.summary.warnings === 0) {
      recommendations.push('所有检查都通过，邮件监听功能运行正常')
    }

    // 添加具体建议
    const dataIntegrityIssues = diagnostics.checks.find(c => c.name === '数据完整性检查')?.details.issues
    if (dataIntegrityIssues && dataIntegrityIssues.length > 0) {
      recommendations.push('建议检查邮件发送代码，确保正确保存Message-ID字段')
    }

    const connectionIssues = diagnostics.checks.find(c => c.name === 'IMAP连接测试')?.details.issues
    if (connectionIssues && connectionIssues.length > 0) {
      recommendations.push('建议检查IMAP服务器设置、网络连接和账户密码')
    }

    return NextResponse.json({
      success: true,
      data: {
        ...diagnostics,
        recommendations
      }
    })

  } catch (error) {
    console.error('邮件监听诊断失败:', error)
    return NextResponse.json(
      { 
        error: '邮件监听诊断失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}