import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { warmupRecoveryService } from '../../../../../lib/warmup-recovery';
import { initializeApp } from '../../../../../lib/app-initializer';

// 全局预热任务管理已移至 warmup-recovery.ts

// 启动预热活动
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const campaignId = params.id;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    
    const currentUser = session.user as { id: string };

    // 检查是否已经在运行中
    const runningTasks = warmupRecoveryService.getRunningTasks();
    const existingTask = runningTasks.find(task => task.campaignId === campaignId);
    if (existingTask?.isRunning) {
      return NextResponse.json({ error: '预热活动已在运行中' }, { status: 400 });
    }

    // 获取预热活动信息
    const campaign = await prisma.warmupCampaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id,
      },
      include: {
        emailProfiles: true,
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: '预热活动不存在' }, { status: 404 });
    }

    if (campaign.emailProfiles.length < 2) {
      return NextResponse.json({ error: '预热活动至少需要2个邮箱配置' }, { status: 400 });
    }

    // 更新活动状态
    await prisma.warmupCampaign.update({
      where: { id: campaignId },
      data: { status: 'active' },
    });

    // 自动启动递归服务（如果尚未启动）
    try {
      await initializeApp();
      console.log(`[INFO] 递归服务已自动启动，确保预热任务持续监控`);
    } catch (error) {
      console.warn(`[WARN] 递归服务启动失败，但不影响当前预热任务:`, error);
    }

    // 使用恢复服务启动预热任务
    await warmupRecoveryService.recoverWarmupCampaign(campaign);

    return NextResponse.json({ 
      message: '预热活动已启动',
      campaignId,
      status: 'active'
    });

  } catch (error) {
    console.error('启动预热活动失败:', error);
    return NextResponse.json({ error: '启动预热活动失败' }, { status: 500 });
  }
}

// 预热活动处理逻辑已移至 warmup-recovery.ts

// 停止预热活动
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const campaignId = params.id;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    
    const currentUser = session.user as { id: string };

    // 验证活动所有权
    const campaign = await prisma.warmupCampaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: '预热活动不存在' }, { status: 404 });
    }

    // 使用恢复服务停止任务
    warmupRecoveryService.stopWarmupCampaign(campaignId);

    // 更新活动状态
    await prisma.warmupCampaign.update({
      where: { id: campaignId },
      data: { status: 'paused' },
    });

    return NextResponse.json({ 
      message: '预热活动已停止',
      campaignId,
      status: 'paused'
    });

  } catch (error) {
    console.error('停止预热活动失败:', error);
    return NextResponse.json({ error: '停止预热活动失败' }, { status: 500 });
  }
}