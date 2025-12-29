import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmailMonitorManager } from '@/lib/email-monitor'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/fix - 修复系统问题
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, actions } = body
    
    // 支持单个action或actions数组
    const actionsToProcess = actions || (action ? [action] : [])
    
    if (actionsToProcess.length === 0) {
      return NextResponse.json(
        { success: false, error: '未指定修复操作' },
        { status: 400 }
      )
    }
    const results = []

    for (const currentAction of actionsToProcess) {
      switch (currentAction) {
      case 'reset_stuck_campaigns':
        // 重置卡住的活动状态
        try {
          const stuckCampaigns = await prisma.campaign.findMany({
            where: {
              status: 'SENDING',
              updatedAt: {
                lt: new Date(Date.now() - 30 * 60 * 1000) // 30分钟前
              }
            }
          })

          for (const campaign of stuckCampaigns) {
            // 不再自动暂停，而是尝试重启卡住的活动
            try {
              // 使用任务恢复服务重启活动
              const { taskRecoveryService } = await import('@/lib/task-recovery')
              await taskRecoveryService.recoverSpecificTask(campaign.id)
              console.log(`[Fix] 重启卡住的活动: ${campaign.id}`)
            } catch (error) {
              console.error(`[Fix] 重启活动失败 ${campaign.id}:`, error)
              // 如果重启失败，标记为失败状态而不是暂停
              await prisma.campaign.update({
                where: { id: campaign.id },
                data: { 
                  status: 'FAILED',
                  updatedAt: new Date()
                }
              })
            }
          }

          results.push({
            action: 'reset_stuck_campaigns',
            success: true,
            message: `尝试重启了 ${stuckCampaigns.length} 个卡住的活动`
          })
        } catch (error) {
          results.push({
            action: 'reset_stuck_campaigns',
            success: false,
            message: `重置活动失败: ${error instanceof Error ? error.message : '未知错误'}`
          })
        }
        break

      case 'restart_email_monitor':
        // 重启邮件监听服务
        try {
          const monitorManager = getEmailMonitorManager()
          await monitorManager.stopMonitoring()
          await new Promise(resolve => setTimeout(resolve, 2000)) // 等待2秒
          await monitorManager.startMonitoring()
          
          results.push({
            action: 'restart_email_monitor',
            success: true,
            message: '邮件监听服务已重启'
          })
        } catch (error) {
          results.push({
            action: 'restart_email_monitor',
            success: false,
            message: `重启邮件监听失败: ${error instanceof Error ? error.message : '未知错误'}`
          })
        }
        break

      case 'clean_failed_emails':
        // 清理失败的邮件记录
        try {
          const result = await prisma.sentEmail.deleteMany({
            where: {
              status: 'failed',
              sentAt: {
                lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前
              }
            }
          })

          results.push({
            action: 'clean_failed_emails',
            success: true,
            message: `清理了 ${result.count} 条失败的邮件记录`
          })
        } catch (error) {
          results.push({
            action: 'clean_failed_emails',
            success: false,
            message: `清理失败邮件记录失败: ${error instanceof Error ? error.message : '未知错误'}`
          })
        }
        break

      case 'restart_queue_service':
        // 重启独立邮件队列服务
        try {
          const { IndependentEmailQueueManager } = await import('@/lib/independent-email-queue')
          const { queueManager } = await import('@/lib/queue-manager')
          
          // 停止所有队列
          const queueManagerInstance = IndependentEmailQueueManager.getInstance()
          await queueManagerInstance.stopAllQueues()
          await new Promise(resolve => setTimeout(resolve, 2000)) // 等待2秒
          
          // 重新初始化队列管理器
          await queueManager.initialize()
          
          results.push({
            action: 'restart_queue_service',
            success: true,
            message: '独立邮件队列服务已重启'
          })
        } catch (error) {
          results.push({
            action: 'restart_queue_service',
            success: false,
            message: `重启队列服务失败: ${error instanceof Error ? error.message : '未知错误'}`
          })
        }
        break

      case 'fix_campaign_counters':
        // 修复活动计数器
        try {
          const campaigns = await prisma.campaign.findMany({
            include: {
              sentEmails: true
            }
          })

          let fixedCount = 0
          for (const campaign of campaigns) {
            const sentCount = campaign.sentEmails.filter(e => e.status === 'sent').length
            const failedCount = campaign.sentEmails.filter(e => e.status === 'failed').length
            
            if (campaign.sentCount !== sentCount || campaign.failedCount !== failedCount) {
              await prisma.campaign.update({
                where: { id: campaign.id },
                data: {
                  sentCount,
                  failedCount
                }
              })
              fixedCount++
            }
          }

          results.push({
            action: 'fix_campaign_counters',
            success: true,
            message: `修复了 ${fixedCount} 个活动的计数器`
          })
        } catch (error) {
          results.push({
            action: 'fix_campaign_counters',
            success: false,
            message: `修复活动计数器失败: ${error instanceof Error ? error.message : '未知错误'}`
          })
        }
        break

        default:
          results.push({
            action: currentAction,
            success: false,
            message: `未知的修复操作: ${currentAction}`
          })
          break
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('修复API错误:', error)
    return NextResponse.json(
      { success: false, error: '修复操作失败' },
      { status: 500 }
    )
  }
}