import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { emailProfileId } = await request.json()

    if (!emailProfileId) {
      return NextResponse.json({ error: '缺少邮件配置ID' }, { status: 400 })
    }

    // 获取邮件配置
    const emailProfile = await prisma.emailProfile.findUnique({
      where: { id: emailProfileId }
    })

    if (!emailProfile) {
      return NextResponse.json({ error: '邮件配置不存在' }, { status: 404 })
    }

    // 创建邮件传输器
    const transportOptions: any = {
      host: emailProfile.smtpServer,
      port: emailProfile.smtpPort,
      secure: emailProfile.smtpPort === 465, // 465端口使用SSL，587端口使用STARTTLS
      auth: {
        user: emailProfile.email,
        pass: emailProfile.password
      },
      // 基础连接配置
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      // TLS配置 - 简化以避免冲突
      tls: {
        rejectUnauthorized: false // 允许自签名证书
      }
    };
    const transporter = nodemailer.createTransport(transportOptions);

    // 验证连接
    await transporter.verify()

    // 发送测试邮件
    const testMailOptions = {
      from: `"${emailProfile.nickname}" <${emailProfile.email}>`,
      to: emailProfile.email, // 发送给自己
      subject: '邮箱连接测试',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">邮箱连接测试成功</h2>
          <p>您的邮箱配置工作正常，可以正常发送邮件。</p>
          <p><strong>发件人:</strong> ${emailProfile.nickname}</p>
          <p><strong>邮箱:</strong> ${emailProfile.email}</p>

          <p><strong>测试时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">此邮件由群发系统自动发送，用于测试邮箱连接。</p>
        </div>
      `
    }

    await transporter.sendMail(testMailOptions)

    return NextResponse.json({
      success: true,
      message: `测试邮件已发送到 ${emailProfile.email}，请检查收件箱确认连接正常`
    })

  } catch (error: any) {
    console.error('邮箱测试失败:', error)
    
    let errorMessage = '邮箱连接测试失败'
    let suggestions: string[] = []
    
    if (error.code === 'EAUTH') {
      errorMessage = '邮箱认证失败'
      suggestions = [
        '检查邮箱地址是否正确',
        '检查密码是否正确',
        '如果是Gmail/QQ邮箱等，请使用应用专用密码',
        '确认已开启SMTP服务'
      ]
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'SMTP服务器连接失败'
      suggestions = [
        '检查SMTP服务器地址是否正确',
        '检查端口号是否正确（常用：465/587/25）',
        '检查网络连接是否正常',
        '确认防火墙未阻止连接'
      ]
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = '连接超时'
      suggestions = [
        '检查网络连接',
        '尝试更换SMTP端口',
        '检查服务器防火墙设置'
      ]
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'SMTP服务器地址无法解析'
      suggestions = [
        '检查SMTP服务器地址拼写',
        '确认服务器地址有效'
      ]
    } else if (error.message) {
      errorMessage = error.message
      suggestions = ['请检查邮箱配置信息']
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      suggestions: suggestions,
      details: {
        code: error.code,
        command: error.command
      }
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}