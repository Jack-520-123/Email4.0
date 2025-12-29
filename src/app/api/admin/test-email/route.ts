import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

// 测试邮箱连通性
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查是否为管理员
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { profileId, testEmail, plainPassword, email, smtpServer, smtpPort } = await request.json()

    // 支持两种模式：1. 使用已保存的配置 2. 使用临时明文配置
    if (!testEmail) {
      return NextResponse.json({ error: '测试邮箱地址不能为空' }, { status: 400 })
    }

    // 如果提供了明文密码和邮箱信息，直接使用（临时测试模式）
    if (plainPassword && email && smtpServer && smtpPort) {
      console.log('使用明文密码临时测试模式')
      
      // 创建邮件传输器（明文模式）
      const transportOptions: any = {
        host: smtpServer,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465,
        auth: {
          user: email,
          pass: plainPassword // 直接使用明文密码
        },
        // 统一使用保守的连接配置
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        pool: false,
        maxConnections: 1,
        maxMessages: 50,
        rateLimit: 1,
        logger: true,
        debug: true,
        tls: {
        rejectUnauthorized: false
      }
      };
      const transporter = nodemailer.createTransport(transportOptions);

      // 验证连接
      await transporter.verify()

      // 发送测试邮件
      const testTime = new Date().toLocaleString('zh-CN')
      const mailOptions = {
        from: `"测试发件人" <${email}>`,
        to: testEmail,
        subject: '邮箱连通性测试 - 群发系统（明文模式）',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; text-align: center;">邮箱连通性测试（明文模式）</h2>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>测试时间：</strong>${testTime}</p>
              <p><strong>发件邮箱：</strong>${email}</p>
              <p><strong>SMTP服务器：</strong>${smtpServer}:${smtpPort}</p>
              <p><strong>测试模式：</strong>明文密码</p>
            </div>
            <div style="background-color: #d4edda; color: #155724; padding: 15px; border-radius: 8px; border: 1px solid #c3e6cb;">
              <p style="margin: 0;">✅ 恭喜！邮箱配置测试成功，可以正常发送邮件。</p>
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px; text-align: center;">此邮件由群发系统自动发送，用于测试邮箱连通性（明文模式）。</p>
          </div>
        `
      }

      await transporter.sendMail(mailOptions)

      return NextResponse.json({ 
        success: true, 
        message: '邮箱连通性测试成功（明文模式），测试邮件已发送',
        details: {
          fromEmail: email,
          toEmail: testEmail,
          smtpServer: smtpServer,
          smtpPort: smtpPort,
          testTime,
          mode: 'plaintext'
        }
      })
    }

    // 使用已保存的配置
    if (!profileId) {
      return NextResponse.json({ error: '邮箱配置ID不能为空' }, { status: 400 })
    }

    // 获取邮箱配置
    const profile = await prisma.emailProfile.findUnique({
      where: { 
        id: profileId,
        isSystemAdmin: true
      }
    })

    if (!profile) {
      return NextResponse.json({ error: '邮箱配置不存在' }, { status: 404 })
    }

    // 使用明文密码
    // 创建邮件传输器
    const transportOptions2: any = {
      host: profile.smtpServer,
      port: profile.smtpPort,
      secure: profile.smtpPort === 465, // 465端口使用SSL，587端口使用STARTTLS
      auth: {
        user: profile.email,
        pass: profile.password
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
    const transporter = nodemailer.createTransport(transportOptions2);

    // 验证连接
    await transporter.verify()

    // 发送测试邮件
    const testTime = new Date().toLocaleString('zh-CN')
    const mailOptions = {
      from: `"${profile.nickname}" <${profile.email}>`,
      to: testEmail,
      subject: '邮箱连通性测试 - 群发系统',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">邮箱连通性测试</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>测试时间：</strong>${testTime}</p>
            <p><strong>发件邮箱：</strong>${profile.email}</p>
            <p><strong>邮箱类型：</strong>${profile.emailType}</p>
            <p><strong>SMTP服务器：</strong>${profile.smtpServer}:${profile.smtpPort}</p>
          </div>
          <div style="background-color: #d4edda; color: #155724; padding: 15px; border-radius: 8px; border: 1px solid #c3e6cb;">
            <p style="margin: 0;">✅ 恭喜！邮箱配置测试成功，可以正常发送邮件。</p>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px; text-align: center;">此邮件由群发系统自动发送，用于测试邮箱连通性。</p>
        </div>
      `
    }

    await transporter.sendMail(mailOptions)

    return NextResponse.json({ 
      success: true, 
      message: '邮箱连通性测试成功，测试邮件已发送',
      details: {
        fromEmail: profile.email,
        toEmail: testEmail,
        smtpServer: profile.smtpServer,
        smtpPort: profile.smtpPort,
        testTime
      }
    })
  } catch (error) {
    console.error('邮箱连通性测试失败:', error)
    
    let errorMessage = '邮箱连通性测试失败'
    if (error instanceof Error) {
      if (error.message.includes('Invalid login')) {
        errorMessage = '邮箱账号或密码错误'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'SMTP服务器连接失败，请检查服务器地址和端口'
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'SMTP服务器地址无效'
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = '连接超时，请检查网络或SMTP服务器设置'
      } else {
        errorMessage = `测试失败: ${error.message}`
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false
      },
      { status: 500 }
    )
  }
}