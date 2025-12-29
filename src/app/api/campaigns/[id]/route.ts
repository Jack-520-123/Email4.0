import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'
import nodemailer from 'nodemailer'
import { taskRecoveryService } from '@/lib/task-recovery'
import { TaskRecoveryService } from '@/lib/task-recovery'
import { campaignLogger } from '@/lib/campaign-logger'

// 获取活动详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        userId: currentUser.id
      },
      include: {
        template: true,
        emailProfile: true,
        excelUpload: true,
        sentEmails: {
          select: {
            id: true,
            recipientEmail: true,
            recipientName: true,
            status: true,
            sentAt: true,
            errorMessage: true
          },
          orderBy: {
            sentAt: 'desc'
          }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    // 检查任务运行状态（队列模式）- 优化状态判断逻辑
    let isRunning = false
    let queueStatus = 'unknown'
    try {
      const queueManager = (await import('@/lib/independent-email-queue')).IndependentEmailQueueManager.getInstance()
      
      // 检查队列是否正在运行
      const queueRunning = queueManager.isQueueRunning(params.id)
      
      if (queueRunning) {
        isRunning = true
        queueStatus = 'running'
      } else if (campaign.status === CampaignStatus.SENDING) {
        // 如果活动状态为SENDING但队列未运行，检查是否需要恢复
        console.log(`[API] 活动 ${params.id} 状态为SENDING但队列未运行，检查是否需要恢复`)
        
        // 检查是否有未完成的邮件
        const remainingEmails = await prisma.sentEmail.count({
          where: {
            campaignId: params.id,
            status: { notIn: ['sent', 'failed'] }
          }
        })
        
        const totalSent = campaign.sentCount + campaign.failedCount
        const hasRemainingWork = totalSent < campaign.totalRecipients || remainingEmails > 0
        
        if (hasRemainingWork) {
          console.log(`[API] 活动 ${params.id} 有未完成工作，标记为需要恢复`)
          queueStatus = 'needs_recovery'
          isRunning = false // 队列确实未运行，但需要恢复
        } else {
          console.log(`[API] 活动 ${params.id} 可能已完成发送`)
          queueStatus = 'completed'
          isRunning = false
        }
      } else {
        // 其他状态下的正常检查
        const taskRecoveryServiceInstance = TaskRecoveryService.getInstance()
        const taskCount = await taskRecoveryServiceInstance.getCampaignTaskCount(params.id)
        isRunning = taskCount > 0
        queueStatus = isRunning ? 'running' : 'idle'
      }
    } catch (error) {
      console.warn('检查任务运行状态失败:', error)
      isRunning = false
      queueStatus = 'error'
    }

    return NextResponse.json({ 
      campaign: {
        ...campaign,
        isRunning,
        queueStatus
      }
    })

  } catch (error) {
    console.error('获取活动详情错误:', error)
    return NextResponse.json({ 
      error: '获取数据失败' 
    }, { status: 500 })
  }
}

// 执行发送活动
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    const { action } = await request.json()

    if (action !== 'start') {
      return NextResponse.json({ error: '无效操作' }, { status: 400 })
    }

    // 获取活动信息
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        userId: currentUser.id
      },
      include: {
        template: true,
        emailProfile: true,
        excelUpload: true
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    if (campaign.status !== CampaignStatus.DRAFT) {
      return NextResponse.json({ error: '活动已执行或正在执行中' }, { status: 400 })
    }

    // 使用队列系统启动活动
    try {
      await taskRecoveryService.startCampaign(params.id)
      
      // 记录启动日志
      await prisma.campaignLog.create({
        data: {
          campaignId: params.id,
          level: 'info',
          message: '活动已启动，使用队列系统发送',
          details: {
            campaignName: campaign.name,
            templateName: campaign.template?.name,
            senderEmail: campaign.emailProfile?.email
          }
        }
      })
      
      return NextResponse.json({ 
        success: true, 
        message: '活动已开始执行（队列模式）' 
      })
    } catch (error) {
      console.error('启动活动失败:', error)
      
      // 恢复活动状态
      await prisma.campaign.update({
        where: { id: params.id },
        data: { status: CampaignStatus.DRAFT }
      })
      
      return NextResponse.json({ 
        error: '启动活动失败' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('执行活动错误:', error)
    return NextResponse.json({ 
      error: '执行活动失败' 
    }, { status: 500 })
  }
}

// 更新活动
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    const body = await request.json()
    const { status, resetStats, isPaused, ...updateData } = body

    // 验证活动是否属于当前用户
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        userId: currentUser.id
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    // 准备更新数据
    const updatePayload: any = { ...updateData }

    // 统一状态管理逻辑
    if (status !== undefined || isPaused !== undefined) {
      // 优先处理明确的状态设置
      if (status) {
        updatePayload.status = status
        
        // 根据状态自动设置 isPaused
        switch (status) {
          case CampaignStatus.PAUSED:
            updatePayload.isPaused = true
            break
          case CampaignStatus.SENDING:
            updatePayload.isPaused = false
            break
          case CampaignStatus.STOPPED:
          case CampaignStatus.COMPLETED:
          case CampaignStatus.FAILED:
            updatePayload.isPaused = false
            break
          default:
            // 其他状态保持原有 isPaused 值
            break
        }
      } else if (isPaused !== undefined) {
        // 如果只设置了 isPaused，需要同步更新 status
        updatePayload.isPaused = isPaused
        
        if (isPaused) {
          // 暂停时，只有在 SENDING 状态下才改为 PAUSED
          if (campaign.status === CampaignStatus.SENDING) {
            updatePayload.status = CampaignStatus.PAUSED
          }
        } else {
          // 恢复时，只有在 PAUSED 状态下才改为 SENDING
          if (campaign.status === CampaignStatus.PAUSED) {
            updatePayload.status = CampaignStatus.SENDING
          }
        }
      }
      
      const statusChangeDetails = {
        原状态: campaign.status,
        原isPaused: campaign.isPaused,
        新状态: updatePayload.status || campaign.status,
        新isPaused: updatePayload.isPaused !== undefined ? updatePayload.isPaused : campaign.isPaused
      }
      
      console.log(`[状态管理] 活动 ${params.id} 状态更新:`, statusChangeDetails)
      
      // 记录状态变更日志
      if (updatePayload.status && updatePayload.status !== campaign.status) {
        campaignLogger.logStatusChange(
          params.id,
          campaign.status,
          updatePayload.status,
          'API_PUT_REQUEST',
          statusChangeDetails
        )
      }
    }

    // 如果需要重置统计数据
    if (resetStats) {
      // 删除所有发送记录
      await prisma.sentEmail.deleteMany({
        where: { campaignId: params.id }
      })
      
      // 重置统计字段
      updatePayload.sentCount = 0
      updatePayload.deliveredCount = 0
      updatePayload.openedCount = 0
      updatePayload.clickedCount = 0
      updatePayload.failedCount = 0
    }

    // 更新活动
    const updatedCampaign = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        ...updatePayload,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ success: true, campaign: updatedCampaign })
  } catch (error) {
    console.error('更新活动失败:', error)
    return NextResponse.json({ error: '更新活动失败' }, { status: 500 })
  }
}

// 删除活动
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        userId: currentUser.id
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    if (campaign.status === CampaignStatus.SENDING) {
      return NextResponse.json({ error: '无法删除正在执行的活动，请先停止活动' }, { status: 400 })
    }

    // 删除相关的发送记录
    await prisma.sentEmail.deleteMany({
      where: { campaignId: params.id }
    })

    // 删除活动
    await prisma.campaign.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ 
      success: true, 
      message: '活动已删除' 
    })

  } catch (error) {
    console.error('删除活动错误:', error)
    return NextResponse.json({ 
      error: '删除活动失败' 
    }, { status: 500 })
  }
}

// 执行发送活动的函数
async function executeCampaign(campaign: any) {
  try {
    // 记录活动开始日志
    await prisma.campaignLog.create({
      data: {
        campaignId: campaign.id,
        level: 'info',
        message: '活动开始执行',
        details: {
          campaignName: campaign.name,
          templateName: campaign.template.name,
          senderEmail: campaign.emailProfile.email
        }
      }
    })

    let recipients: any[] = []

    // 从数据库读取收件人数据
    if (campaign.excelUpload) {
      const jsonData = campaign.excelUpload.data as any[]
      if (jsonData && Array.isArray(jsonData)) {
        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            level: 'info',
            message: '开始读取收件人数据',
            details: { source: 'database' }
          }
        })
        
        recipients = jsonData.map((row: any) => {
          // 查找邮箱列
          const emailKey = Object.keys(row).find(key => 
            key.toLowerCase().includes('email') || key.toLowerCase().includes('邮箱')
          )
          
          // 查找姓名列
          const nameKey = Object.keys(row).find(key => 
            key.toLowerCase().includes('name') || key.toLowerCase().includes('姓名') || key.toLowerCase().includes('名称')
          )
          
          return {
            email: emailKey ? row[emailKey] : '',
            name: nameKey ? row[nameKey] : ''
          }
        }).filter(r => r.email) // 过滤掉没有邮箱的记录

        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            level: 'info',
            message: `成功读取收件人数据，共 ${recipients.length} 个有效邮箱`,
            details: { totalRecipients: recipients.length }
          }
        })
      } else {
        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            level: 'error',
            message: '收件人数据不存在',
            details: { source: 'database' }
          }
        })
        throw new Error('收件人数据不存在')
      }
    } else if (campaign.recipientList && campaign.recipientList.recipients) {
      // 从收件人列表读取收件人
      recipients = campaign.recipientList.recipients.map((recipient: any) => ({
        email: recipient.email,
        name: recipient.name || ''
      }))
      
      await prisma.campaignLog.create({
        data: {
          campaignId: campaign.id,
          level: 'info',
          message: `从收件人列表读取数据，共 ${recipients.length} 个收件人`,
          details: { totalRecipients: recipients.length }
        }
      })
    }

    // 创建邮件传输器
    await prisma.campaignLog.create({
      data: {
        campaignId: campaign.id,
        level: 'info',
        message: '正在配置SMTP连接',
        details: {
          smtpServer: campaign.emailProfile.smtpServer,
          smtpPort: campaign.emailProfile.smtpPort,
          senderEmail: campaign.emailProfile.email
        }
      }
    })

    const transportOptions: any = {
      host: campaign.emailProfile.smtpServer,
      port: campaign.emailProfile.smtpPort,
      secure: campaign.emailProfile.smtpPort === 465,
      auth: {
        user: campaign.emailProfile.email,
        pass: campaign.emailProfile.password
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

    // 验证SMTP连接
    try {
      await transporter.verify()
      await prisma.campaignLog.create({
        data: {
          campaignId: campaign.id,
          level: 'info',
          message: 'SMTP连接验证成功',
          details: {
            smtpServer: campaign.emailProfile.smtpServer,
            smtpPort: campaign.emailProfile.smtpPort
          }
        }
      })
    } catch (verifyError: any) {
      await prisma.campaignLog.create({
        data: {
          campaignId: campaign.id,
          level: 'error',
          message: 'SMTP连接验证失败',
          details: {
            error: verifyError.message,
            smtpServer: campaign.emailProfile.smtpServer,
            smtpPort: campaign.emailProfile.smtpPort
          }
        }
      })
      throw verifyError
    }

    let sentCount = 0
    let failedCount = 0

    // 批量发送邮件
    for (const recipient of recipients) {
      try {
        // 替换模板中的变量
        let content = campaign.template.htmlContent
        let subject = campaign.template.subject
        
        if (recipient.name) {
          content = content.replace(/\{\{name\}\}/g, recipient.name)
          subject = subject.replace(/\{\{name\}\}/g, recipient.name)
        }
        
        content = content.replace(/\{\{email\}\}/g, recipient.email)
        subject = subject.replace(/\{\{email\}\}/g, recipient.email)

        const mailOptions = {
          from: `${campaign.emailProfile.nickname} <${campaign.emailProfile.email}>`,
          to: recipient.email,
          subject: subject,
          html: content
        }

        const info = await transporter.sendMail(mailOptions)
        
        // 记录发送成功
        await prisma.sentEmail.create({
          data: {
            userId: campaign.userId,
            campaignId: campaign.id,
            templateId: campaign.templateId,
            emailProfileId: campaign.emailProfileId,
            recipientEmail: recipient.email,
            recipientName: recipient.name || '',
            subject: subject,
            body: content,
            status: 'SENT'
          }
        })

        // 记录发送成功日志
        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            level: 'info',
            message: `邮件发送成功: ${recipient.email}`,
            details: {
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              messageId: info?.messageId || 'N/A',
              response: info?.response || 'N/A'
            }
          }
        })
        
        sentCount++
        
        // 更新活动进度
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { sentCount }
        })
        
        // 在Serverless环境中减少延迟时间
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (error: any) {
        console.error(`发送邮件失败 ${recipient.email}:`, error)
        
        // 重新获取模板内容用于错误记录
        let content = campaign.template.htmlContent
        let subject = campaign.template.subject
        
        if (recipient.name) {
          content = content.replace(/\{\{name\}\}/g, recipient.name)
          subject = subject.replace(/\{\{name\}\}/g, recipient.name)
        }
        
        content = content.replace(/\{\{email\}\}/g, recipient.email)
        subject = subject.replace(/\{\{email\}\}/g, recipient.email)
        
        // 记录发送失败
        await prisma.sentEmail.create({
          data: {
            userId: campaign.userId,
            campaignId: campaign.id,
            templateId: campaign.templateId,
            emailProfileId: campaign.emailProfileId,
            recipientEmail: recipient.email,
            recipientName: recipient.name || '',
            subject: subject,
            body: content,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : '发送失败'
          }
        })

        // 记录发送失败日志
        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            level: 'error',
            message: `邮件发送失败: ${recipient.email}`,
            details: {
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              error: error.message,
              code: error.code,
              command: error.command
            }
          }
        })
        
        failedCount++
      }
    }

    // 更新活动状态为完成
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: CampaignStatus.COMPLETED,
        sentCount,
        failedCount
      }
    })

    // 记录活动完成日志
    await prisma.campaignLog.create({
      data: {
        campaignId: campaign.id,
        level: 'info',
        message: '活动执行完成',
        details: {
          totalRecipients: recipients.length,
          sentCount,
          failedCount,
          successRate: recipients.length > 0 ? ((sentCount / recipients.length) * 100).toFixed(2) + '%' : '0%'
        }
      }
    })

  } catch (error: any) {
    console.error('执行活动失败:', error)
    
    // 记录活动失败日志
    await prisma.campaignLog.create({
      data: {
        campaignId: campaign.id,
        level: 'error',
        message: '活动执行失败',
        details: {
          error: error.message,
          stack: error.stack
        }
      }
    })
    
    // 更新活动状态为失败
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: CampaignStatus.FAILED
      }
    })
  }
}