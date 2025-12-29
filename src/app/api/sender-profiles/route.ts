import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 获取发件人配置列表
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    }

    const profiles = await prisma.emailProfile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nickname: true,
        email: true,
        password: true,
        smtpServer: true,
        smtpPort: true,
        imapServer: true,
        imapPort: true,
        imapSecure: true,
        enableMonitoring: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('获取发件人配置失败:', error);
    return NextResponse.json(
      { message: '获取发件人配置失败' },
      { status: 500 }
    );
  }
}

// 创建发件人配置
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    }

    const { 
      nickname, 
      email, 
      password, 
      smtpServer, 
      smtpPort,
      imapServer,
      imapPort,
      imapSecure,
      enableMonitoring
    } = await request.json();

    // 验证必填字段
    if (!nickname || !email || !password || !smtpServer || !smtpPort) {
      return NextResponse.json(
        { message: '请填写完整的发件人信息' },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // 检查邮箱是否已存在
    const existingProfile = await prisma.emailProfile.findFirst({
      where: {
        userId: user.id,
        email: email,
      },
    });

    if (existingProfile) {
      return NextResponse.json(
        { message: '该邮箱已存在发件人配置' },
        { status: 400 }
      );
    }

    // 直接存储明文授权码（邮箱授权码需要明文发送给SMTP服务器）

    // 创建发件人配置
    const profile = await prisma.emailProfile.create({
      data: {
        userId: user.id,
        nickname,
        email,
        password: password,
        smtpServer,
        smtpPort: parseInt(smtpPort),
        imapServer: imapServer || null,
        imapPort: imapPort ? parseInt(imapPort) : null,
        imapSecure: imapSecure !== undefined ? imapSecure : true,
        enableMonitoring: enableMonitoring || false,
      },
      select: {
        id: true,
        nickname: true,
        email: true,
        smtpServer: true,
        smtpPort: true,
        imapServer: true,
        imapPort: true,
        imapSecure: true,
        enableMonitoring: true,
        createdAt: true,
      },
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error('创建发件人配置失败:', error);
    return NextResponse.json(
      { message: '创建发件人配置失败' },
      { status: 500 }
    );
  }
}