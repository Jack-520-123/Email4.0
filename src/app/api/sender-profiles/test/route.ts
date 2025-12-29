import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

// 测试发件人配置
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const { profileId, testEmail, plainPassword, email, smtpServer, smtpPort } = await request.json();

    if (!testEmail) {
      return NextResponse.json({ error: '测试邮箱地址不能为空' }, { status: 400 });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return NextResponse.json({ error: '测试邮箱格式不正确' }, { status: 400 });
    }

    let senderConfig;

    // 如果提供了明文密码和邮箱信息，直接使用（临时测试模式）
    if (plainPassword && email && smtpServer && smtpPort) {
      senderConfig = {
        email,
        password: plainPassword,
        smtpServer,
        smtpPort: parseInt(smtpPort)
      };
    } else if (profileId) {
      // 使用已保存的配置
      const profile = await prisma.emailProfile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
        },
      });

      if (!profile) {
        return NextResponse.json(
          { error: '发件人配置不存在或无权限访问' },
          { status: 404 }
        );
      }

      senderConfig = {
        email: profile.email,
        password: profile.password,
        smtpServer: profile.smtpServer,
        smtpPort: profile.smtpPort
      };
    } else {
      return NextResponse.json(
        { error: '请提供发件人配置信息' },
        { status: 400 }
      );
    }

    // 创建邮件传输器
    const transportOptions: any = {
      host: senderConfig.smtpServer,
      port: senderConfig.smtpPort,
      secure: senderConfig.smtpPort === 465,
      auth: {
        user: senderConfig.email,
        pass: senderConfig.password
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    };
    const transporter = nodemailer.createTransport(transportOptions);

    // 验证连接
    await transporter.verify();

    // 发送测试邮件
    const mailOptions = {
      from: `"测试邮件" <${senderConfig.email}>`,
      to: testEmail,
      subject: '邮件配置测试',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">邮件配置测试成功</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #666;">这是一封测试邮件，用于验证您的邮件配置是否正确。</p>
            <p style="margin: 10px 0 0 0; color: #666;">发件人：${senderConfig.email}</p>
            <p style="margin: 5px 0 0 0; color: #666;">SMTP服务器：${senderConfig.smtpServer}:${senderConfig.smtpPort}</p>
            <p style="margin: 5px 0 0 0; color: #666;">发送时间：${new Date().toLocaleString('zh-CN')}</p>
          </div>
          <p style="text-align: center; color: #28a745; font-weight: bold;">✅ 邮件配置测试成功！</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ 
      success: true, 
      message: '测试邮件发送成功',
      testEmail,
      senderEmail: senderConfig.email
    });

  } catch (error: any) {
    console.error('测试邮件发送失败:', error);
    
    // 根据错误类型返回更具体的错误信息
    if (error.code === 'EAUTH') {
      return NextResponse.json(
        { error: '邮箱认证失败，请检查邮箱地址和密码' },
        { status: 400 }
      );
    } else if (error.code === 'ECONNECTION') {
      return NextResponse.json(
        { error: 'SMTP服务器连接失败，请检查服务器地址和端口' },
        { status: 400 }
      );
    } else if (error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: '连接超时，请检查网络连接和SMTP服务器设置' },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: error.message || '测试邮件发送失败' },
        { status: 500 }
      );
    }
  }
}