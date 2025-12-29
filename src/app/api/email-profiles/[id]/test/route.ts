import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import nodemailer from 'nodemailer'

// POST /api/email-profiles/[id]/test - 测试邮箱配置
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 获取邮箱配置
    const profile = await prisma.emailProfile.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!profile) {
      return NextResponse.json({ error: '邮箱配置不存在' }, { status: 404 })
    }

    // 使用明文密码
    // 创建邮件传输器
    const transportOptions: any = {
      host: profile.smtpServer,
      port: profile.smtpPort,
      secure: profile.smtpPort === 465,
      auth: {
        user: profile.email,
        pass: profile.password, // 使用明文密码
      },
      // 统一使用保守的连接配置
      connectionTimeout: 30000, // 30秒连接超时
      greetingTimeout: 30000, // 30秒问候超时
      socketTimeout: 30000, // 30秒socket超时
      pool: false, // 不使用连接池
      maxConnections: 1, // 最大连接数为1
      maxMessages: 50, // 每个连接最大消息数
      rateLimit: 1, // 每秒最大邮件数设为1
      logger: true, // 启用日志
      debug: true, // 启用调试
      tls: {
          rejectUnauthorized: false // 允许自签名证书
        }
    };
    const transporter = nodemailer.createTransport(transportOptions);

    // 验证连接
    await transporter.verify()

    // 发送测试邮件到自己
    const testMailOptions = {
      from: {
        name: profile.nickname,
        address: profile.email,
      },
      to: profile.email,
      subject: '邮箱配置测试 - 群发系统',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">邮箱配置测试成功！</h2>
          <p style="color: #374151; line-height: 1.6;">恭喜！您的邮箱配置已成功通过测试。</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin: 0 0 10px 0;">邮箱配置测试成功！</h3>
            <p style="margin: 5px 0; color: #6b7280;"><strong>配置名称：</strong> ${profile.nickname}</p>
            <p style="margin: 5px 0; color: #6b7280;"><strong>邮箱地址：</strong> ${profile.email}</p>
          </div>
          <p style="color: #374151; line-height: 1.6;">您的邮箱配置工作正常，可以正常发送邮件。</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            此邮件由群发系统自动发送，用于测试邮箱配置。<br>
            测试时间：${new Date().toLocaleString('zh-CN')}
          </p>
        </div>
      `,
    }

    await transporter.sendMail(testMailOptions)

    return NextResponse.json({ 
      success: true, 
      message: '邮箱配置测试成功，测试邮件已发送到您的邮箱' 
    })
  } catch (error) {
    console.error('测试邮箱配置失败:', error)
    
    let errorMessage = '邮箱配置测试失败';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return NextResponse.json(
      { error: `测试失败: ${errorMessage}` },
      { status: 400 }
    );
  }
}