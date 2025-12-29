import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { IndependentEmailQueueManager } from '@/lib/independent-email-queue'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const campaignId = params.id;

    // 验证用户权限
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: session.user.id,
      },
      select: { 
        id: true, 
        name: true, 
        status: true, 
        sentCount: true, 
        failedCount: true, 
        totalRecipients: true,
        lastSentAt: true,
        createdAt: true
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在或无权访问' }, { status: 404 });
    }

    // 获取最近的日志记录（最近100条）
    const logs = await prisma.campaignLog.findMany({
      where: {
        campaignId: campaignId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    // 获取队列中的任务状态
    const queueManager = IndependentEmailQueueManager.getInstance();
    const campaignQueue = queueManager.getCampaignQueue(campaignId);
    const queueStats = campaignQueue ? campaignQueue.getStats() : null;
    const campaignTaskCount = queueStats ? queueStats.queueLength : 0;
    
    // 获取全局队列统计信息
    const globalStats = queueManager.getGlobalStats();
    const allStats = queueManager.getAllStats();
    
    // 计算全局队列的总待处理和处理中任务数
    let totalPending = 0;
    let totalProcessing = 0;
    Object.values(allStats).forEach(stats => {
      totalPending += stats.pending || 0;
      totalProcessing += stats.processing || 0;
    });
    
    // 格式化日志为实时显示格式
    const formattedLogs = logs.map(log => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      level: log.level,
      message: log.message,
      details: log.details,
      formattedTime: log.createdAt.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    })).reverse(); // 按时间正序排列，最新的在底部

    // 计算进度信息
    const progress = {
      total: campaign.totalRecipients || 0,
      sent: campaign.sentCount || 0,
      failed: campaign.failedCount || 0,
      pending: campaignTaskCount,
      percentage: campaign.totalRecipients > 0 
        ? Math.round(((campaign.sentCount || 0) / campaign.totalRecipients) * 100) 
        : 0
    };

    // 获取当前发送速率（最近5分钟的发送量）
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentSentCount = await prisma.campaignLog.count({
      where: {
        campaignId: campaignId,
        level: 'info',
        message: { contains: '邮件发送成功' },
        createdAt: { gte: fiveMinutesAgo }
      }
    });

    const sendingRate = {
      emailsPer5Min: recentSentCount,
      emailsPerHour: Math.round(recentSentCount * 12), // 估算每小时发送量
    };

    // 如果没有日志且活动刚创建，添加一些基础信息
    if (formattedLogs.length === 0) {
      const basicInfo = [
        {
          id: 'info-1',
          timestamp: campaign.createdAt.toISOString(),
          level: 'info',
          message: `📧 活动创建: ${campaign.name}`,
          details: null,
          formattedTime: campaign.createdAt.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        },
        {
          id: 'info-2',
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `📊 状态: ${campaign.status} | 总数: ${campaign.totalRecipients} | 已发送: ${campaign.sentCount} | 失败: ${campaign.failedCount}`,
          details: null,
          formattedTime: new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        }
      ];
      formattedLogs.push(...basicInfo);
    }

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        lastSentAt: campaign.lastSentAt
      },
      logs: formattedLogs,
      progress,
      sendingRate,
      queueStats: {
        isRunning: campaignQueue ? campaignQueue.isRunning() : false,
        isPaused: campaignQueue ? campaignQueue.isPaused() : false,
        pending: queueStats?.pending || 0,
        processing: queueStats?.processing || 0,
        completed: queueStats?.completed || 0,
        failed: queueStats?.failed || 0,
        campaignPending: campaignTaskCount,
        totalPending: totalPending,
        totalProcessing: totalProcessing,
        activeQueues: globalStats.activeQueues || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`获取活动 ${params.id} 实时日志失败:`, error);
    return NextResponse.json(
      { error: '获取实时日志失败' },
      { status: 500 }
    );
  }
}