import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TaskRecoveryService } from '@/lib/task-recovery'
import { IndependentEmailQueueManager } from '@/lib/independent-email-queue'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'
import { campaignLogger } from '@/lib/campaign-logger'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    const campaignId = params.id

    // 验证活动是否属于当前用户
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在或无权限' }, { status: 404 })
    }

    // 检查活动状态
    if (!['SENDING', 'PAUSED'].includes(campaign.status)) {
      return NextResponse.json({ 
        error: '只能恢复状态为SENDING或PAUSED的活动',
        currentStatus: campaign.status 
      }, { status: 400 })
    }

    console.log(`[队列恢复] 开始恢复活动 ${campaignId} 的队列`)

    // 执行队列恢复操作
    const queueManager = IndependentEmailQueueManager.getInstance()
    const recoveryResult = await performQueueRecovery(campaignId, queueManager)

    if (recoveryResult.success) {
      // 如果活动当前是暂停状态且不是手动暂停，恢复为发送中
      if (campaign.status === CampaignStatus.PAUSED && !campaign.isPaused) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: CampaignStatus.SENDING,
            isPaused: false,
            updatedAt: new Date()
          }
        })
        console.log(`[队列恢复] 活动 ${campaignId} 状态已恢复为发送中`)
      }

      // 同时使用任务恢复服务作为备用
      const taskRecoveryService = TaskRecoveryService.getInstance()
      await taskRecoveryService.startCampaign(campaignId)

      // 记录恢复成功日志
      campaignLogger.logRecovery(
        campaignId,
        'QUEUE_RECOVERY',
        { success: true, method: 'manual', steps: ['stop', 'wait', 'restart', 'verify'] },
        'API_RECOVER_REQUEST'
      )

      return NextResponse.json({
        success: true,
        message: '队列恢复成功',
        details: recoveryResult.details,
        campaignId
      })
    } else {
      return NextResponse.json({
        success: false,
        error: '队列恢复失败',
        details: recoveryResult.error
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[队列恢复] 恢复失败:', error)
    
    // 记录恢复失败日志
    campaignLogger.logRecovery(
      params.id,
      'QUEUE_RECOVERY',
      { success: false, error: error instanceof Error ? error.message : '未知错误', method: 'manual' },
      'API_RECOVER_REQUEST'
    )
     
     campaignLogger.logError(params.id, error instanceof Error ? error : new Error(String(error)), 'API_RECOVER_REQUEST', { action: 'queue_recovery' })
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '队列恢复过程中发生错误' },
      { status: 500 }
    )
  }
}

/**
 * 执行队列恢复操作
 */
async function performQueueRecovery(campaignId: string, queueManager: IndependentEmailQueueManager) {
  try {
    const details: string[] = []

    // 1. 检查队列当前状态
    const queue = queueManager.getCampaignQueue(campaignId)
    const queueStatus = queue ? queue.getStats() : null
    details.push(`队列当前状态: ${JSON.stringify(queueStatus)}`)

    // 2. 停止现有队列（如果存在）
    const stopResult = await queueManager.stopCampaignQueue(campaignId)
    if (stopResult.success) {
      details.push('已停止现有队列')
    }

    // 3. 等待一段时间确保队列完全停止
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 4. 重新启动队列
    const startResult = await queueManager.startCampaignQueue(campaignId)
    if (startResult.success) {
      details.push('队列重新启动成功')
    } else {
      throw new Error(`队列启动失败: ${startResult.error}`)
    }

    // 5. 验证队列是否正常运行
    await new Promise(resolve => setTimeout(resolve, 1000))
    const newQueue = queueManager.getCampaignQueue(campaignId)
    const newQueueStatus = newQueue ? { isRunning: newQueue.isRunning(), stats: newQueue.getStats() } : null
    details.push(`恢复后队列状态: ${JSON.stringify(newQueueStatus)}`)

    if (newQueueStatus && newQueueStatus.isRunning) {
      details.push('队列恢复验证成功')
      return { success: true, details }
    } else {
      throw new Error('队列恢复后仍未正常运行')
    }

  } catch (error) {
    console.error('[队列恢复] 恢复过程失败:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
}

/**
 * 获取队列恢复状态信息
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const campaignId = params.id
    const currentUser = session.user as { id: string }

    // 验证活动所有权
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在或无权限' }, { status: 404 })
    }

    // 获取队列状态信息
    const queueManager = IndependentEmailQueueManager.getInstance()
    const queue = queueManager.getCampaignQueue(campaignId)
    const queueStatus = queue ? {
      isRunning: queue.isRunning(),
      isPaused: queue.isPaused(),
      stats: queue.getStats()
    } : null
    
    // 检查是否需要恢复
    const needsRecovery = (
      (campaign.status === CampaignStatus.SENDING || campaign.status === CampaignStatus.PAUSED) &&
      (!queueStatus || !queueStatus.isRunning) &&
      !campaign.isPaused
    )

    return NextResponse.json({
      campaignStatus: campaign.status,
      isPaused: campaign.isPaused,
      queueStatus,
      needsRecovery,
      canRecover: campaign.status === CampaignStatus.SENDING || campaign.status === CampaignStatus.PAUSED
    })

  } catch (error) {
    console.error('[队列恢复] 获取状态失败:', error)
    return NextResponse.json({ 
      error: '获取队列状态失败' 
    }, { status: 500 })
  }
}