import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'
import { TaskRecoveryService } from '@/lib/task-recovery'
import { IndependentEmailQueueManager } from '@/lib/independent-email-queue'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const campaignId = params.id
    const { action } = await request.json() // 'pause' 或 'resume'

    // 检查活动是否存在且属于当前用户
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在或无权限' }, { status: 404 })
    }

    const taskRecoveryService = TaskRecoveryService.getInstance()
    const campaignTaskCount = await taskRecoveryService.getCampaignTaskCount(campaignId)

    if (action === 'pause') {
      if (campaignTaskCount === 0) {
        return NextResponse.json({ error: '当前活动没有在运行中' }, { status: 400 })
      }

      // 使用队列系统暂停任务
      await taskRecoveryService.pauseCampaign(campaignId)

      return NextResponse.json({ 
        success: true,
        message: '活动已暂停（队列模式）',
        status: CampaignStatus.PAUSED
      })

    } else if (action === 'resume') {
      if (campaign.status !== CampaignStatus.PAUSED) {
        return NextResponse.json({ error: '活动未处于暂停状态' }, { status: 400 })
      }

      // 使用队列系统恢复任务
      await taskRecoveryService.startCampaign(campaignId)

      return NextResponse.json({ 
        success: true,
        message: '活动已恢复（队列模式）',
        status: CampaignStatus.SENDING
      })

    } else if (action === 'stop') {
      // 检查活动是否在运行中
      const queueManager = IndependentEmailQueueManager.getInstance()
      const queue = queueManager.getCampaignQueue(campaignId)
      
      if (!queue || !queue.isRunning()) {
        return NextResponse.json({ error: '活动未在运行中' }, { status: 400 })
      }

      // 使用队列系统停止任务
      await taskRecoveryService.stopCampaign(campaignId)

      return NextResponse.json({ 
        message: '活动已停止',
        status: CampaignStatus.STOPPED
      })

    } else {
      return NextResponse.json({ error: '无效的操作' }, { status: 400 })
    }

  } catch (error) {
    console.error('暂停/恢复活动失败:', error)
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// 获取活动状态
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    const campaignId = params.id
    
    // 检查活动是否存在且属于当前用户
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在或无权限' }, { status: 404 })
    }

    // 获取队列状态
    const queueManager = IndependentEmailQueueManager.getInstance()
    const queue = queueManager.getCampaignQueue(campaignId)
    const queueStats = queue ? queue.getStats() : null
    
    return NextResponse.json({
      campaignId,
      status: campaign.status,
      isRunning: queue ? queue.isRunning() : false,
      isPaused: queue ? queue.isPaused() : false,
      queueLength: queueStats?.queueLength || 0,
      processing: queueStats?.processing || 0,
      sentCount: campaign.sentCount || 0,
      failedCount: campaign.failedCount || 0,
      totalRecipients: campaign.totalRecipients || 0
    })

  } catch (error) {
    console.error('获取活动状态失败:', error)
    return NextResponse.json(
      { error: '获取状态失败' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}