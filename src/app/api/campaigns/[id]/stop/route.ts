import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TaskRecoveryService } from '@/lib/task-recovery'
import { CampaignStatus } from '@prisma/client'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const campaignId = params.id
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
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
    
    // 检查活动状态
    if (!['SENDING', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      return NextResponse.json({ error: '只能停止正在发送、暂停或计划中的活动' }, { status: 400 })
    }
    
    // 使用队列系统停止活动
    const taskRecoveryService = TaskRecoveryService.getInstance()
    await taskRecoveryService.stopCampaign(campaignId)
    
    console.log(`[StopCampaign] 活动 ${campaignId} 已停止`)
    
    return NextResponse.json({
      success: true,
      message: '活动已停止',
      status: CampaignStatus.STOPPED
    })
    
  } catch (error) {
    console.error('[StopCampaign] 停止活动失败:', error)
    return NextResponse.json(
      { error: '停止活动失败' },
      { status: 500 }
    )
  }
}