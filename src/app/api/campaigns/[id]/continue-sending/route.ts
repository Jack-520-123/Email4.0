import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TaskRecoveryService } from '@/lib/task-recovery'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'

/**
 * 继续发送邮件的 API 端点
 * 用于支持递归调用策略，在不依赖 CRON 的情况下继续发送邮件
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const campaignId = params.id
  
  try {
    // 检查是否为内部调用
    const isInternalCall = request.headers.get('X-Internal-Call') === 'true'
    let currentUser: { id: string }
    
    if (isInternalCall) {
      // 内部调用：从数据库获取活动的用户ID
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { userId: true }
      })
      
      if (!campaign) {
        return NextResponse.json({ error: '活动不存在' }, { status: 404 })
      }
      
      currentUser = { id: campaign.userId }
      console.log(`[ContinueSending] 内部调用，活动 ${campaignId} 属于用户 ${campaign.userId}`)
    } else {
      // 外部调用：需要验证会话
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json({ error: '未授权' }, { status: 401 })
      }
      currentUser = session.user as { id: string }
    }

    // 获取活动信息
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id,
      },
      select: {
        id: true,
        status: true,
        name: true,
        sentCount: true,
        scheduledAt: true
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    // 检查活动状态 - 允许SENDING、PAUSED和STOPPED状态的活动继续发送
    if (campaign.status !== CampaignStatus.SENDING && 
        campaign.status !== CampaignStatus.PAUSED && 
        campaign.status !== CampaignStatus.STOPPED) {
      return NextResponse.json({ 
        error: '活动状态不正确，只能继续发送中、已暂停或已停止的活动',
        currentStatus: campaign.status 
      }, { status: 400 })
    }

    // 检查是否已经在运行（队列模式）
    const taskRecoveryService = TaskRecoveryService.getInstance()
    const campaignTaskCount = await taskRecoveryService.getCampaignTaskCount(campaignId)
    if (campaignTaskCount > 0) {
      // 当前活动正在处理中
      console.log(`[CONTINUE-SENDING] 活动 ${campaignId} 队列中有任务在处理，跳过重复启动检查`)
    }

    // 检查是否到达定时发送时间
    if (campaign.scheduledAt) {
      const scheduledTime = new Date(campaign.scheduledAt)
      const now = new Date()
      
      if (scheduledTime > now) {
        const delay = Math.round((scheduledTime.getTime() - now.getTime()) / 1000)
        return NextResponse.json({ 
          error: `尚未到达发送时间，还需等待 ${delay} 秒`,
          scheduledAt: scheduledTime.toISOString()
        }, { status: 400 })
      }
    }

    console.log(`[ContinueSending] 开始继续发送任务: ${campaignId} (使用队列模式)`)

    // 清除 scheduledAt 时间
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { scheduledAt: null }
    })

    // 根据活动状态选择合适的恢复方法
    let operationResult = { success: false, error: '', method: '' }
    
    try {
      // 设置操作超时时间为25秒，避免504超时
      const operationPromise = (async () => {
        if (campaign.status === CampaignStatus.PAUSED) {
          // 对于暂停的活动，使用恢复方法
          console.log(`[ContinueSending] 尝试恢复暂停的活动: ${campaignId}`)
          const { IndependentEmailQueueManager } = await import('@/lib/independent-email-queue')
          const result = await IndependentEmailQueueManager.getInstance().resumeCampaignQueue(campaignId)
          operationResult = { 
            success: result.success, 
            error: result.error || '', 
            method: 'resumeCampaignQueue' 
          }
          
          if (!result.success) {
            console.error(`[ContinueSending] 恢复队列失败: ${campaignId}, 错误: ${result.error}`)
            throw new Error(`恢复队列失败: ${result.error || '未知错误'}`)
          }
          console.log(`[ContinueSending] 已成功恢复暂停的活动: ${campaignId}`)
        } else {
          // 对于其他状态的活动，使用启动方法
          console.log(`[ContinueSending] 尝试启动活动: ${campaignId}, 当前状态: ${campaign.status}`)
          await taskRecoveryService.startCampaign(campaignId)
          operationResult = { success: true, error: '', method: 'startCampaign' }
          console.log(`[ContinueSending] 已成功启动活动: ${campaignId}`)
        }
      })()
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('操作超时，请稍后重试')), 25000)
      })
      
      await Promise.race([operationPromise, timeoutPromise])
      
      // 记录成功日志
      await prisma.campaignLog.create({
        data: {
          campaignId,
          level: 'info',
          message: '继续发送操作成功',
          details: {
            method: operationResult.method,
            previousStatus: campaign.status,
            timestamp: new Date().toISOString(),
            source: 'continue_sending_api'
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: '继续发送任务已启动（队列模式）',
        campaignId,
        method: operationResult.method
      })
    } catch (operationError) {
      const errorMessage = operationError instanceof Error ? operationError.message : String(operationError)
      console.error(`[ContinueSending] 操作失败: ${campaignId}, 方法: ${operationResult.method}, 错误: ${errorMessage}`)
      
      // 记录详细的错误日志
      await prisma.campaignLog.create({
        data: {
          campaignId,
          level: 'error',
          message: '继续发送操作失败',
          details: {
            method: operationResult.method,
            error: errorMessage,
            previousStatus: campaign.status,
            timestamp: new Date().toISOString(),
            source: 'continue_sending_api'
          }
        }
      })
      
      throw operationError
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[ContinueSending] 继续发送任务失败:`, errorMessage)

    return NextResponse.json({ 
      error: `继续发送任务失败: ${errorMessage}` 
    }, { status: 500 })
  }
}

/**
 * 获取活动发送状态
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const campaignId = params.id
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    // 获取活动信息
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id,
      },
      select: {
        id: true,
        status: true,
        name: true,
        sentCount: true,
        failedCount: true,
        scheduledAt: true,
        lastSentAt: true
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    // 检查任务运行状态（队列模式）
    const taskRecoveryService = TaskRecoveryService.getInstance()
    const campaignTaskCount = await taskRecoveryService.getCampaignTaskCount(campaignId)
    const isRunning = campaignTaskCount > 0

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        scheduledAt: campaign.scheduledAt,
        lastSentAt: campaign.lastSentAt,
        isRunning
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[ContinueSending] 获取活动状态失败:`, errorMessage)

    return NextResponse.json({ 
      error: `获取活动状态失败: ${errorMessage}` 
    }, { status: 500 })
  }
}