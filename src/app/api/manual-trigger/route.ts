import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'
import { TaskRecoveryService } from '@/lib/task-recovery'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    console.log('[MANUAL-TRIGGER] 手动触发定时任务检查...')
    
    // 查找所有需要发送的定时活动（包括暂停的任务）
    const now = new Date()
    const scheduledCampaigns = await prisma.campaign.findMany({
      where: {
        OR: [
          {
            status: CampaignStatus.SCHEDULED,
            scheduledAt: { lte: now }
          },
          {
            status: CampaignStatus.PAUSED,
            scheduledAt: { lte: now }
          },
          {
            status: CampaignStatus.SENDING,
            // 检查可能中断的发送任务
            lastSentAt: {
              lt: new Date(Date.now() - 10 * 60 * 1000) // 10分钟前
            }
          }
        ]
      },
      include: {
        template: true,
        emailProfile: true,
        excelUpload: true,
        user: true
      }
    })

    console.log(`[MANUAL-TRIGGER] 找到 ${scheduledCampaigns.length} 个需要处理的活动`)

    let processedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const campaign of scheduledCampaigns) {
      try {
        // 检查任务是否已经在队列中运行
        const taskRecoveryService = TaskRecoveryService.getInstance()
        const campaignTaskCount = await taskRecoveryService.getCampaignTaskCount(campaign.id)
        if (campaignTaskCount > 0) {
          console.log(`[MANUAL-TRIGGER] 活动 ${campaign.id} 已在队列中运行，跳过`)
          skippedCount++
          continue
        }

        console.log(`[MANUAL-TRIGGER] 开始处理活动: ${campaign.id}`)
        
        // 使用队列系统启动活动
        await taskRecoveryService.startCampaign(campaign.id)

        processedCount++
        console.log(`[MANUAL-TRIGGER] 活动 ${campaign.id} 处理成功`)
        
      } catch (error) {
        errorCount++
        console.error(`[MANUAL-TRIGGER] 处理活动 ${campaign.id} 时发生错误:`, error)
      }
    }

    const result = {
      success: true,
      message: '手动触发完成',
      stats: {
        total: scheduledCampaigns.length,
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount
      }
    }

    console.log('[MANUAL-TRIGGER] 手动触发结果:', result)
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('[MANUAL-TRIGGER] 手动触发失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '手动触发失败', 
        details: error instanceof Error ? error.message : '未知错误' 
      }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 获取队列状态
    const taskRecoveryService = TaskRecoveryService.getInstance()
    const globalQueueStats = taskRecoveryService.getQueueStats()

    // 获取数据库中的活动状态
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: {
          in: [CampaignStatus.SCHEDULED, CampaignStatus.SENDING, CampaignStatus.PAUSED]
        }
      },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        sentCount: true,
        failedCount: true,
        lastSentAt: true
      }
    })

    return NextResponse.json({
      success: true,
      queueStats: globalQueueStats,
      campaigns: campaigns,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('[MANUAL-TRIGGER] 获取状态失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取状态失败', 
        details: error instanceof Error ? error.message : '未知错误' 
      }, 
      { status: 500 }
    )
  }
}