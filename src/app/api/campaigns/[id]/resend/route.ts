import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'
import { IndependentEmailQueueManager } from '@/lib/independent-email-queue'

// 重新发送活动（从头开始）
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
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    // 检查活动是否可以重新发送
    if (campaign.status === CampaignStatus.SENDING) {
      return NextResponse.json({ error: '活动正在发送中，无法重新发送' }, { status: 400 })
    }

    console.log(`[API] 开始重新发送活动: ${campaignId}`)

    // 停止现有队列（如果存在）
    const queueManager = IndependentEmailQueueManager.getInstance()
    await queueManager.stopCampaignQueue(campaignId)

    // 删除所有发送记录
    await prisma.sentEmail.deleteMany({
      where: { campaignId }
    })

    // 重置活动统计数据并设置为发送状态
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.SENDING,
        isPaused: false,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        failedCount: 0,
        lastSentAt: null
      }
    })

    // 启动新的发送队列
    const result = await queueManager.startCampaignQueue(campaignId)

    if (result.success) {
      console.log(`[API] 活动 ${campaignId} 重新发送启动成功`)
      return NextResponse.json({ 
        success: true, 
        message: '活动已开始重新发送，将从头开始发送给所有收件人' 
      })
    } else {
      console.error(`[API] 活动 ${campaignId} 重新发送启动失败:`, result.error)
      // 如果启动失败，恢复活动状态
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.STOPPED }
      })
      return NextResponse.json({ 
        error: result.error || '重新发送启动失败' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('重新发送活动失败:', error)
    return NextResponse.json({ error: '重新发送失败' }, { status: 500 })
  }
}