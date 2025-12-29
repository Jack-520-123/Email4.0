import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 删除预热活动
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

    // 停止正在运行的任务（如果有）
    if (global.warmupTasks) {
      const task = global.warmupTasks.get(campaignId);
      if (task) {
        task.isRunning = false;
        global.warmupTasks.delete(campaignId);
      }
    }

    // 删除相关的日志记录
    await prisma.warmupLog.deleteMany({
      where: {
        warmupCampaignId: campaignId,
      },
    });

    // 删除预热活动
    await prisma.warmupCampaign.delete({
      where: { id: campaignId },
    });

    return NextResponse.json({ 
      message: '预热活动已删除',
      campaignId
    });

  } catch (error) {
    console.error('删除预热活动失败:', error);
    return NextResponse.json({ error: '删除预热活动失败' }, { status: 500 });
  }
}