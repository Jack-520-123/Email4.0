import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TaskRecoveryService } from '@/lib/task-recovery'
import * as nodemailer from 'nodemailer'
import { addEmailTracking } from '@/lib/email-tracking'
import { IndependentEmailQueueManager } from '@/lib/independent-email-queue'
import { campaignLogger } from '@/lib/campaign-logger'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const campaignId = params.id
  let taskRegistered = false
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    // 检查是否已经在发送中
    const queueManager = IndependentEmailQueueManager.getInstance()
    if (queueManager.isQueueRunning(campaignId)) {
      return NextResponse.json({ error: '活动已在运行中' }, { status: 400 })
    }

    // 获取活动信息
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id,
      },
      include: {
        template: true,
        emailProfile: true,
        excelUpload: true,
        recipientList: {
          include: {
            recipients: true
          }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.PAUSED && campaign.status !== CampaignStatus.STOPPED) {
      return NextResponse.json({ error: '活动状态不正确，只能启动草稿、暂停或已停止的活动' }, { status: 400 })
    }

    // 检查任务是否已经在运行中（独立队列模式）
    if (queueManager.isQueueRunning(campaignId)) {
      return NextResponse.json({ error: '活动已在运行中' }, { status: 400 })
    }

    // 验证必要的配置
    if (!campaign.template) {
      return NextResponse.json({ error: '活动缺少邮件模板' }, { status: 400 })
    }

    if (!campaign.emailProfile) {
      return NextResponse.json({ error: '活动缺少邮件配置' }, { status: 400 })
    }

    // 验证收件人数据源
    if (campaign.recipientSource === 'excelUpload' && !campaign.excelUpload) {
      return NextResponse.json({ error: '活动缺少Excel文件' }, { status: 400 })
    }
    
    if (campaign.recipientSource === 'recipientList' && (!campaign.recipientList || !campaign.recipientList.recipients?.length)) {
      return NextResponse.json({ error: '活动缺少收件人列表' }, { status: 400 })
    }
    
    if (campaign.recipientSource === 'recipientGroup' && campaign.groupSelectionMode === 'specific' && (!campaign.selectedGroups || (campaign.selectedGroups as string[]).length === 0)) {
      return NextResponse.json({ error: '活动缺少选中的分组' }, { status: 400 })
    }
    
    // 兼容旧版本：如果没有设置recipientSource，使用原有逻辑
    if (!campaign.recipientSource && !campaign.excelUpload && (!campaign.recipientList || !campaign.recipientList.recipients?.length)) {
      return NextResponse.json({ error: '活动缺少收件人列表' }, { status: 400 })
    }

    // 检查定时发送逻辑
    const scheduledAt = campaign.scheduledAt ? new Date(campaign.scheduledAt) : null
    const now = new Date()

    if (scheduledAt && scheduledAt > now) {
      // 定时发送：更新状态为SCHEDULED，等待定时触发
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { 
          status: CampaignStatus.SCHEDULED,
          isPaused: false
        },
      })

      const delay = scheduledAt.getTime() - now.getTime()
      console.log(`活动 "${campaign.name}" 设置为定时发送，将在 ${delay / 1000} 秒后由cron任务处理。`)

      return NextResponse.json({
        success: true,
        message: `定时发送任务已设置，将在 ${scheduledAt.toLocaleString('zh-CN')} 开始发送`,
        campaignId,
        scheduledAt: scheduledAt.toISOString()
      })

    } else {
      // 立即发送逻辑 - 使用队列系统
      if (campaign.status === CampaignStatus.DRAFT) {
        console.log(
          `[INFO] 活动 "${campaign.name}" 从草稿状态启动，清除历史发送记录...`
        );
        await prisma.sentEmail.deleteMany({
          where: { campaignId: campaignId },
        });
        console.log(`[INFO] 历史记录已清除。`);
      }

      const startMessage = campaign.status === CampaignStatus.DRAFT
        ? '从草稿状态启动'
        : campaign.status === CampaignStatus.PAUSED
        ? '从暂停状态恢复'
        : '从停止状态重启';

      console.log(`[INFO] 活动 "${campaign.name}" ${startMessage} (使用独立队列模式)`);

      // 使用独立队列系统启动活动
      const result = await queueManager.startCampaignQueue(campaignId)
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: '发送任务已启动（独立队列模式）',
          campaignId
        })
      } else {
        throw new Error(result.error || '启动队列失败')
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('启动发送任务失败:', errorMessage)

    // 如果任务已注册但启动失败，需要清理队列状态
    if (taskRegistered) {
      try {
        const queueManager = IndependentEmailQueueManager.getInstance()
        const cleanupResult = await queueManager.stopCampaignQueue(campaignId)
        if (cleanupResult.success) {
          console.log(`清理失败的队列状态: ${campaignId}`)
        } else {
          console.error('清理队列状态失败:', cleanupResult.error)
        }
      } catch (cleanupError) {
        console.error('清理队列状态失败:', cleanupError)
      }

      // 同时恢复活动状态并记录错误信息
      try {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: CampaignStatus.FAILED, // 直接标记为失败
            isPaused: false
          }
        })
      } catch (dbError) {
        console.error('恢复活动状态失败:', dbError)
      }
    }

    return NextResponse.json({ error: `启动发送任务失败: ${errorMessage}` }, { status: 500 })
  }
}

// 暂停发送任务
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const { action } = await request.json()
    const campaignId = params.id

    // 验证活动是否属于当前用户
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    const queueManager = IndependentEmailQueueManager.getInstance()
    
    if (action === 'pause') {
      if (!queueManager.isQueueRunning(campaignId)) {
        return NextResponse.json({ error: '活动未在运行中' }, { status: 400 })
      }
      
      const result = await queueManager.pauseCampaignQueue(campaignId)
      
      if (result.success) {
        // 统一状态管理：更新活动状态为暂停
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { 
            status: CampaignStatus.PAUSED,
            isPaused: true,
            updatedAt: new Date()
          }
        })
        
        console.log(`[状态管理] 活动 ${campaignId} 已暂停`)
        
        // 记录暂停操作日志
        campaignLogger.logStatusChange(
          campaignId,
          campaign.status,
          CampaignStatus.PAUSED,
          'API_PAUSE_REQUEST',
          { isPaused: true, reason: 'manual_pause' }
        )
        
        return NextResponse.json({ success: true, message: '活动已暂停' })
      } else {
        return NextResponse.json({ error: result.error || '暂停失败' }, { status: 500 })
      }
    } else if (action === 'resume') {
      // 检查队列是否在运行
      const isQueueRunning = queueManager.isQueueRunning(campaignId)
      
      let result
      if (isQueueRunning) {
        // 队列在运行，只需要恢复暂停状态
        result = await queueManager.resumeCampaignQueue(campaignId)
      } else {
        // 队列未运行，需要重新启动队列
        console.log(`[恢复操作] 活动 ${campaignId} 队列未运行，重新启动队列`)
        result = await queueManager.startCampaignQueue(campaignId)
      }
      
      if (result.success) {
        // 统一状态管理：更新活动状态为发送中
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { 
            status: CampaignStatus.SENDING,
            isPaused: false,
            updatedAt: new Date()
          }
        })
        
        console.log(`[状态管理] 活动 ${campaignId} 已恢复发送`)
        
        // 记录恢复操作日志
        campaignLogger.logStatusChange(
          campaignId,
          campaign.status,
          CampaignStatus.SENDING,
          'API_RESUME_REQUEST',
          { isPaused: false, reason: 'manual_resume', queueWasRunning: isQueueRunning }
        )
        
        return NextResponse.json({ success: true, message: '活动已恢复' })
      } else {
        return NextResponse.json({ error: result.error || '恢复失败' }, { status: 500 })
      }
    } else if (action === 'stop') {
      // 停止独立队列
      const result = await queueManager.stopCampaignQueue(campaignId)
      
      // 统一状态管理：更新活动状态为停止
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { 
          status: CampaignStatus.STOPPED,
          isPaused: false,
          updatedAt: new Date()
        }
      })
      
      console.log(`[状态管理] 活动 ${campaignId} 已停止`)
      
      // 记录停止操作日志
      campaignLogger.logStatusChange(
        campaignId,
        campaign.status,
        CampaignStatus.STOPPED,
        'API_STOP_REQUEST',
        { isPaused: false, reason: 'manual_stop' }
      )
      
      return NextResponse.json({ 
        success: true, 
        message: result.success ? '活动已停止，可重新启动或删除' : '活动已停止（队列可能已不存在）' 
      })
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 })
  } catch (error) {
    console.error('操作失败:', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}

// 注意：原有的 processSendingTask 函数已被独立队列系统替代
// 所有邮件发送逻辑现在由 IndependentEmailQueueManager 和 CampaignQueue 处理