import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

// 发送邮件
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const { templateId, recipientListId, emailProfileId } = await request.json()

    if (!templateId || !recipientListId || !emailProfileId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 获取模板
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        userId: currentUser.id
      }
    })

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    // 获取邮箱配置
    const emailProfile = await prisma.emailProfile.findFirst({
      where: {
        id: emailProfileId,
        userId: currentUser.id
      }
    })

    if (!emailProfile) {
      return NextResponse.json(
        { error: '邮箱配置不存在' },
        { status: 404 }
      )
    }

    // 获取收件人列表
    const recipientList = await prisma.recipientList.findFirst({
      where: {
        id: recipientListId,
        userId: currentUser.id
      },
      include: {
        recipients: {
          orderBy: [
            { sortOrder: 'asc' },
            { createdAt: 'asc' }
          ]
        }
      }
    })

    if (!recipientList || recipientList.recipients.length === 0) {
      return NextResponse.json({ error: '收件人列表为空' }, { status: 400 })
    }

    // 使用明文密码
    // 创建邮件传输器
    const transportOptions: any = {
      host: emailProfile.smtpServer,
      port: emailProfile.smtpPort,
      secure: emailProfile.smtpPort === 465,
      auth: {
        user: emailProfile.email,
        pass: emailProfile.password
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



    // 发送结果统计
    const results = {
      total: recipientList.recipients.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ email: string; error: string }>
    }

    // 批量发送邮件
    for (const recipient of recipientList.recipients) {
      // 替换模板中的变量
      let personalizedContent = template.htmlContent
      let personalizedSubject = template.subject
      
      try {
        
        // 简单的变量替换（可以根据需要扩展）
        const currentDate = new Date().toLocaleDateString('zh-CN')
        personalizedContent = personalizedContent.replace(/\{\{name\}\}/g, recipient.name || recipient.email)
        personalizedContent = personalizedContent.replace(/\{\{recipient_name\}\}/g, recipient.name || recipient.email)
        personalizedContent = personalizedContent.replace(/\{\{email\}\}/g, recipient.email)
        const timestamp = currentDate // 使用现有的 currentDate 作为 timestamp
      personalizedContent = personalizedContent.replace(/\{\{timestamp\}\}/g, timestamp)
      // 兼容旧的占位符
      personalizedContent = personalizedContent.replace(/\{\{current_date\}\}/g, currentDate)
        personalizedSubject = personalizedSubject.replace(/\{\{name\}\}/g, recipient.name || recipient.email)
        personalizedSubject = personalizedSubject.replace(/\{\{recipient_name\}\}/g, recipient.name || recipient.email)
        personalizedSubject = personalizedSubject.replace(/\{\{email\}\}/g, recipient.email)
        personalizedSubject = personalizedSubject.replace(/\{\{timestamp\}\}/g, timestamp)
      // 兼容旧的占位符
      personalizedSubject = personalizedSubject.replace(/\{\{current_date\}\}/g, currentDate)

        // 发送邮件
        await transporter.sendMail({
          from: `${emailProfile.nickname} <${emailProfile.email}>`,
          to: recipient.email,
          subject: personalizedSubject,
          html: personalizedContent
        })

        // 记录成功日志
        await prisma.sentEmail.create({
          data: {
            userId: currentUser.id,
            templateId,
            emailProfileId,
            campaignId: 'manual-send', // 手动发送的邮件使用固定标识
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject: personalizedSubject,
            body: personalizedContent,
            status: 'sent'
          }
        })

        results.success++
      } catch (error) {
        console.error(`发送邮件到 ${recipient.email} 失败:`, error)
        
        // 记录失败日志
        await prisma.sentEmail.create({
          data: {
            userId: currentUser.id,
            campaignId: 'manual-send', // 手动发送的邮件使用固定标识,
            templateId,
            emailProfileId,
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject: personalizedSubject,
            body: personalizedContent,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : '未知错误'
          }
        })

        results.failed++
        results.errors.push({
          email: recipient.email,
          error: error instanceof Error ? error.message : '未知错误'
        })
      }

      // 在Serverless环境中减少延迟时间
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return NextResponse.json({
      message: '邮件发送完成',
      results
    })
  } catch (error) {
    console.error('邮件发送失败:', error)
    return NextResponse.json({ error: '邮件发送失败' }, { status: 500 })
  }
}