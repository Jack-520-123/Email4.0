import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 删除发件人配置
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    console.log(`尝试删除发件人配置 ID: ${id}, 用户ID: ${user.id}`);

    // 检查发件人配置是否存在且属于当前用户
    const profile = await prisma.emailProfile.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!profile) {
      console.log(`发件人配置不存在: ID=${id}, 用户ID=${user.id}`);
      return NextResponse.json(
        { message: '发件人配置不存在或无权限访问' },
        { status: 404 }
      );
    }

    console.log(`找到发件人配置: ${profile.email}`);

    // 使用事务确保原子性操作
    await prisma.$transaction(async (prisma) => {
      // 检查并删除关联的 SentEmail 记录
      const sentEmails = await prisma.sentEmail.findMany({
        where: { emailProfileId: id },
      });
      if (sentEmails.length > 0) {
        await prisma.sentEmail.deleteMany({
          where: { emailProfileId: id },
        });
      }

      // 检查并删除关联的 Campaign 记录
      const campaigns = await prisma.campaign.findMany({
        where: { emailProfileId: id },
      });
      if (campaigns.length > 0) {
        await prisma.campaign.deleteMany({
          where: { emailProfileId: id },
        });
      }

      // 最后删除 EmailProfile
      await prisma.emailProfile.delete({
        where: {
          id,
          userId: user.id,
        },
      });
    });

    return NextResponse.json({ message: '发件人配置删除成功' });
  } catch (error: any) {
    console.error('删除发件人配置失败:', error);
    
    // 提供更详细的错误信息
    let errorMessage = '删除发件人配置失败';
    if (error.code === 'P2025') {
      errorMessage = '发件人配置不存在或已被删除';
    } else if (error.code === 'P2003') {
      errorMessage = '该发件人配置被其他数据引用，无法删除';
    } else if (error.message) {
      errorMessage = `删除失败: ${error.message}`;
    }
    
    return NextResponse.json(
      { message: errorMessage },
      { status: 500 }
    );
  }
}

// 获取单个发件人配置
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    const profile = await prisma.emailProfile.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        nickname: true,
        email: true,
        smtpServer: true,
        smtpPort: true,
        createdAt: true,
        updatedAt: true,
        // 不返回密码
      },
    });

    if (!profile) {
      return NextResponse.json(
        { message: '发件人配置不存在或无权限访问' },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('获取发件人配置失败:', error);
    return NextResponse.json(
      { message: '获取发件人配置失败' },
      { status: 500 }
    );
  }
}

// 更新发件人配置
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const { nickname, email, password, smtpServer, smtpPort } = await request.json();

    // 检查发件人配置是否存在且属于当前用户
    const existingProfile = await prisma.emailProfile.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingProfile) {
      return NextResponse.json(
        { message: '发件人配置不存在或无权限访问' },
        { status: 404 }
      );
    }

    // 验证必填字段
    if (!nickname || !email || !smtpServer || !smtpPort) {
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

    // 检查邮箱是否已被其他配置使用
    if (email !== existingProfile.email) {
      const duplicateProfile = await prisma.emailProfile.findFirst({
        where: {
          userId: user.id,
          email: email,
          id: { not: id },
        },
      });

      if (duplicateProfile) {
        return NextResponse.json(
          { message: '该邮箱已存在其他发件人配置' },
          { status: 400 }
        );
      }
    }

    // 准备更新数据
    const updateData: any = {
      nickname,
      email,
      smtpServer,
      smtpPort: parseInt(smtpPort),
    };

    // 如果提供了新密码，则更新
    if (password) {
      updateData.password = password;
    }

    // 更新发件人配置
    const updatedProfile = await prisma.emailProfile.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nickname: true,
        email: true,
        smtpServer: true,
        smtpPort: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('更新发件人配置失败:', error);
    return NextResponse.json(
      { message: '更新发件人配置失败' },
      { status: 500 }
    );
  }
}