import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'
import { TaskRecoveryService } from '@/lib/task-recovery'

export async function GET(request: NextRequest) {
  try {
    console.log('[CRON] 开始检查定时发送任务...')
    
    // 查找所有需要发送的定时活动（包括SCHEDULED和SENDING状态）
    const now = new Date()
    const scheduledCampaigns = await prisma.campaign.findMany({
      where: {
        OR: [
          {
            status: CampaignStatus.SCHEDULED,
            scheduledAt: {
              lte: now
            }
          },
          {
            status: CampaignStatus.SENDING,
            scheduledAt: {
              lte: now
            }
          }
        ]
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

    console.log(`[CRON] 发现 ${scheduledCampaigns.length} 个需要处理的定时任务`)

    const results = []
    
    for (const campaign of scheduledCampaigns) {
      const campaignId = campaign.id
      
      // 检查是否已经在队列中运行
      const taskRecoveryService = TaskRecoveryService.getInstance()
      const campaignTaskCount = await taskRecoveryService.getCampaignTaskCount(campaignId)
      if (campaignTaskCount > 0) {
        console.log(`[CRON] 任务 ${campaignId} 已在队列中运行，跳过`)
        results.push({ campaignId, status: 'already_running' })
        continue
      }

      try {
        console.log(`[CRON] 启动定时任务: ${campaignId}`)
        
        // 使用队列系统启动活动
        await taskRecoveryService.startCampaign(campaignId)
        
        results.push({ campaignId, status: 'started' })
        
      } catch (error) {
        console.error(`[CRON] 启动任务 ${campaignId} 失败:`, error)
        results.push({ 
          campaignId, 
          status: 'error', 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    }

    console.log(`[CRON] 定时任务检查完成，处理了 ${results.length} 个任务`)
    
    return NextResponse.json({
      success: true,
      message: `处理了 ${results.length} 个定时任务`,
      results
    })
    
  } catch (error) {
    console.error('[CRON] 定时任务处理失败:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// 支持POST请求（用于手动触发）
export async function POST(request: NextRequest) {
  return GET(request)
}