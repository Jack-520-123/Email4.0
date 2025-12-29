import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { testEmail } = await request.json()
    const campaignId = params.id

    if (!testEmail) {
      return NextResponse.json({ error: '请提供测试邮箱地址' }, { status: 400 })
    }

    // 获取活动信息
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        emailProfile: true
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    if (!campaign.emailProfile) {
      return NextResponse.json({ error: '未配置发件人信息' }, { status: 400 })
    }

    if (!campaign.template) {
      return NextResponse.json({ error: '未配置邮件模板' }, { status: 400 })
    }

    // 创建邮件传输器
    const transportOptions: any = {
      host: campaign.emailProfile.smtpServer,
      port: campaign.emailProfile.smtpPort,
      secure: campaign.emailProfile.smtpPort === 465,
      auth: {
        user: campaign.emailProfile.email,
        pass: campaign.emailProfile.password,
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

    // 记录测试开始日志
    await prisma.campaignLog.create({
      data: {
        campaignId: campaignId,
        level: 'info',
        message: `开始发送测试邮件到 ${testEmail}`,
        details: {
          testEmail,
          senderEmail: campaign.emailProfile.email,
          smtpServer: campaign.emailProfile.smtpServer,
          smtpPort: campaign.emailProfile.smtpPort
        }
      }
    })

    try {
      // 验证SMTP连接
      await transporter.verify()
      
      await prisma.campaignLog.create({
        data: {
          campaignId: campaignId,
          level: 'info',
          message: 'SMTP连接验证成功',
          details: {
            smtpServer: campaign.emailProfile.smtpServer,
            smtpPort: campaign.emailProfile.smtpPort
          }
        }
      })

      // 发送测试邮件
      const now = new Date()
      const currentDate = now.toLocaleDateString('zh-CN')
      const currentDateTime = now.toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      })
      const currentTime = now.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      })
      const testRecipientName = '测试用户'
      const testRecipientEmail = testEmail
      
      // 替换模板中的占位符
      let testContent = campaign.template.htmlContent
        .replace(/{{name}}/g, testRecipientName)
        .replace(/{{recipient_name}}/g, testRecipientName)
        .replace(/{{email}}/g, testRecipientEmail)
        .replace(/{{greeting}}/g, '您好')
        .replace(/{{timestamp}}/g, currentDateTime)
        // 兼容旧的占位符
        .replace(/{{current_date}}/g, currentDate)
        .replace(/{{current_datetime}}/g, currentDateTime)
        .replace(/{{current_time}}/g, currentTime)
      
      let testSubject = campaign.template.subject
        .replace(/{{name}}/g, testRecipientName)
        .replace(/{{recipient_name}}/g, testRecipientName)
        .replace(/{{email}}/g, testRecipientEmail)
        .replace(/{{greeting}}/g, '您好')
        .replace(/{{current_date}}/g, currentDate)
        .replace(/{{current_datetime}}/g, currentDateTime)
        .replace(/{{current_time}}/g, currentTime)
      
      const mailOptions = {
        from: `"${campaign.emailProfile.nickname}" <${campaign.emailProfile.email}>`,
        to: testEmail,
        subject: `[测试] ${testSubject}`,
        html: `
          <div style="border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; background-color: #fef3c7;">
            <h3 style="color: #d97706; margin: 0 0 10px 0;">🧪 这是一封测试邮件</h3>
            <p style="color: #92400e; margin: 0;">此邮件用于测试群发系统的邮件发送功能，请忽略邮件内容。</p>
          </div>
          <hr style="margin: 20px 0;">
          <div>
            ${testContent}
          </div>
          <hr style="margin: 20px 0;">
          <div style="font-size: 12px; color: #6b7280; text-align: center;">
            <p>测试时间: ${new Date().toLocaleString('zh-CN')}</p>
            <p>活动名称: ${campaign.name}</p>
          </div>
        `
      }

      const info = await transporter.sendMail(mailOptions)
      
      // 记录发送成功日志
      await prisma.campaignLog.create({
        data: {
          campaignId: campaignId,
          level: 'info',
          message: '测试邮件发送成功',
          details: {
            testEmail,
            messageId: info?.messageId || 'N/A',
            response: info?.response || 'N/A'
          }
        }
      })

      return NextResponse.json({ 
        success: true, 
        message: '测试邮件发送成功',
        messageId: info?.messageId || 'N/A'
      })

    } catch (smtpError: any) {
      // 记录SMTP错误日志
      await prisma.campaignLog.create({
        data: {
          campaignId: campaignId,
          level: 'error',
          message: 'SMTP连接或发送失败',
          details: {
            error: smtpError.message,
            code: smtpError.code,
            command: smtpError.command,
            testEmail
          }
        }
      })

      return NextResponse.json({ 
        error: `邮件发送失败: ${smtpError.message}`,
        details: {
          code: smtpError.code,
          command: smtpError.command
        }
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('测试邮件发送失败:', error)
    
    // 记录系统错误日志
    try {
      await prisma.campaignLog.create({
        data: {
          campaignId: params.id,
          level: 'error',
          message: '系统错误',
          details: {
            error: error.message,
            stack: error.stack
          }
        }
      })
    } catch (logError) {
      console.error('记录日志失败:', logError)
    }

    return NextResponse.json({ 
      error: '系统错误，请重试',
      details: error.message
    }, { status: 500 })
  }
}