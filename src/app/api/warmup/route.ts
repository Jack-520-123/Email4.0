import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomInt } from 'crypto';

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 创建新的预热活动
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: '未授权访问' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await req.json();
    const { name, emailProfileIds, minSendDelay, maxSendDelay } = data;

    // 验证必要参数
    if (!name || !emailProfileIds || !Array.isArray(emailProfileIds) || emailProfileIds.length < 2) {
      return new Response(JSON.stringify({ error: '参数无效' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 创建预热活动
    const warmupCampaign = await prisma.warmupCampaign.create({
      data: {
        name,
        userId: session.user.id,
        minSendDelay: minSendDelay || 2,
        maxSendDelay: maxSendDelay || 30,
        emailProfiles: {
          connect: emailProfileIds.map(id => ({ id })),
        },
      },
      include: {
        emailProfiles: true,
      },
    });

    return new Response(JSON.stringify(warmupCampaign), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('创建预热活动失败:', error);
    return new Response(JSON.stringify({ error: '创建预热活动失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// 获取预热活动列表
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: '未授权访问' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const warmupCampaigns = await prisma.warmupCampaign.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        emailProfiles: true,
        logs: {
          take: 10,
          orderBy: {
            sentAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return new Response(JSON.stringify(warmupCampaigns), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('获取预热活动列表失败:', error);
    return new Response(JSON.stringify({ error: '获取预热活动列表失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}