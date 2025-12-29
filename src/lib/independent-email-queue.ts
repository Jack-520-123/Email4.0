import { CampaignStatus } from '@prisma/client'
import nodemailer from 'nodemailer'
import { prisma } from './prisma'
import { addEmailTracking } from './email-tracking'
import { batchDB } from './batch-db-operations'

// 邮件任务接口
interface EmailTask {
  id: string
  campaignId: string
  recipientEmail: string
  recipientName?: string
  subject: string
  content: string
  emailProfile: {
    email: string
    password: string
    smtpHost: string
    smtpPort: number
    nickname?: string
  }
  retryCount: number
  maxRetries: number
  createdAt: Date
  emailId?: string
}

// 队列状态
interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
}

// 独立活动队列类
class CampaignQueue {
  private queue: EmailTask[] = []
  private processing: Set<string> = new Set()
  private _isRunning = false
  private consumers: number = 1
  private maxConcurrency = 3 // 每个活动的最大并发数
  private stats: QueueStats = { pending: 0, processing: 0, completed: 0, failed: 0 }
  private lastSendTime = 0
  private campaignId: string
  private sendInterval: number = 60000 // 默认60秒
  private enableRandomInterval: boolean = false
  private randomIntervalMin: number = 1
  private randomIntervalMax: number = 3
  private isAddingTasks: boolean = false // 防重入锁：正在添加任务
  private lastTaskAddTime: number = 0 // 上次添加任务的时间
  private consumerCount: number = 0 // 当前运行的消费者数量

  constructor(campaignId: string) {
    this.campaignId = campaignId
    console.log(`[CampaignQueue] 为活动 ${campaignId} 创建独立队列`)
  }

  // 启动队列消费者
  async start(concurrency: number = 1): Promise<void> {
    if (this._isRunning) {
      console.log(`[CampaignQueue-${this.campaignId}] 队列已在运行中`)
      return
    }

    // 获取活动的发送配置
    await this.loadCampaignSettings()

    // 强制设置为单线程发送，避免被识别为垃圾邮件
    this.maxConcurrency = 1
    this._isRunning = true

    console.log(`[CampaignQueue-${this.campaignId}] 启动独立队列，单线程发送模式（避免垃圾邮件风险）`)

    // 只启动一个消费者，确保一封一封发送
    if (this.consumerCount === 0) {
      this.startConsumer(0)
    } else {
      console.log(`[CampaignQueue-${this.campaignId}] 消费者已在运行中 (count=${this.consumerCount})，跳过重复启动`)
    }

    // 启动队列健康检查
    this.startHealthCheck() // 重新启用健康检查
  }

  // 停止队列
  async stop(): Promise<void> {
    this._isRunning = false
    this.processing.clear()
    // 停止健康检查
    this.stopHealthCheck()
    // 强制刷新所有批量操作
    await batchDB.forceFlush()
    console.log(`[CampaignQueue-${this.campaignId}] 队列已停止，批量操作已刷新`)
  }

  // 暂停队列
  async pause(): Promise<void> {
    this._isRunning = false
    // 停止健康检查
    this.stopHealthCheck()
    // 清理处理中的任务状态，但保留队列中的任务
    this.processing.clear()
    this.stats.processing = 0
    console.log(`[CampaignQueue-${this.campaignId}] 暂停独立队列，保留队列任务: ${this.queue.length} 个`)
  }

  // 恢复队列
  async resume(): Promise<void> {
    if (!this._isRunning) {
      this._isRunning = true
      // 重新启动健康检查
      this.startHealthCheck()
      // 启动消费者处理剩余任务（只启动一个消费者，确保单线程发送）
      this.startConsumer(0)
      console.log(`[CampaignQueue-${this.campaignId}] 恢复独立队列，继续处理任务: ${this.queue.length} 个`)
    }
  }

  // 加载活动设置
  private async loadCampaignSettings(): Promise<void> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: this.campaignId },
        select: {
          enableRandomInterval: true,
          randomIntervalMin: true,
          randomIntervalMax: true
        }
      })

      if (campaign) {
        // 使用默认发送间隔60秒（秒转毫秒）
        this.sendInterval = 60 * 1000
        this.enableRandomInterval = campaign.enableRandomInterval || false
        this.randomIntervalMin = campaign.randomIntervalMin || 1
        this.randomIntervalMax = campaign.randomIntervalMax || 3

        console.log(`[CampaignQueue-${this.campaignId}] 加载配置:`, {
          sendInterval: this.sendInterval / 1000,
          enableRandomInterval: this.enableRandomInterval,
          randomIntervalMin: this.randomIntervalMin,
          randomIntervalMax: this.randomIntervalMax
        })
      }
    } catch (error) {
      console.error(`[CampaignQueue-${this.campaignId}] 加载配置失败:`, error)
    }
  }

  // 添加邮件任务到队列
  async addEmailTask(task: Omit<EmailTask, 'id' | 'createdAt' | 'retryCount'>): Promise<string> {
    const emailTask: EmailTask = {
      ...task,
      id: `${task.campaignId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0,
      createdAt: new Date()
    }

    this.queue.push(emailTask)
    this.stats.pending++

    console.log(`[CampaignQueue-${this.campaignId}] 添加邮件任务: ${emailTask.id}, 队列长度: ${this.queue.length}`)
    return emailTask.id
  }

  // 批量添加活动的所有邮件任务
  async addCampaignTasks(): Promise<void> {
    // 防重入保护：如果正在添加任务，则跳过
    if (this.isAddingTasks) {
      console.log(`[CampaignQueue-${this.campaignId}] 正在添加任务中，跳过重复调用`)
      return
    }

    // 防重入保护：如果最近刚添加过任务（5秒内），则跳过
    const now = Date.now()
    if (this.lastTaskAddTime > 0 && now - this.lastTaskAddTime < 5000) {
      console.log(`[CampaignQueue-${this.campaignId}] 最近${Math.round((now - this.lastTaskAddTime) / 1000)}秒前刚添加过任务，跳过重复调用`)
      return
    }

    // 设置添加任务标志
    this.isAddingTasks = true
    this.lastTaskAddTime = now

    try {
      console.log(`[CampaignQueue-${this.campaignId}] 开始创建邮件任务`)

      // 获取活动信息
      const campaign = await prisma.campaign.findUnique({
        where: { id: this.campaignId },
        include: {
          template: true,
          emailProfile: true,
          excelUpload: true,
          recipientList: {
            include: { recipients: true }
          }
        }
      })

      if (!campaign) {
        throw new Error(`活动 ${this.campaignId} 不存在`)
      }

      // 获取收件人列表
      let recipients = []
      if (campaign.excelUploadId && campaign.excelUpload?.data) {
        recipients = campaign.excelUpload.data as any[]
      } else if (campaign.recipientListId) {
        recipients = campaign.recipientList?.recipients || []
      } else if (campaign.recipientSource === 'recipientGroup') {
        // 处理分组选择的收件人
        let groupFilter = {}

        if (campaign.groupSelectionMode === 'specific' && campaign.selectedGroups) {
          const selectedGroups = typeof campaign.selectedGroups === 'string'
            ? JSON.parse(campaign.selectedGroups)
            : campaign.selectedGroups

          groupFilter = {
            group: {
              in: selectedGroups
            }
          }
        } else {
          groupFilter = {
            group: {
              not: null
            },
            AND: {
              group: {
                not: ''
              }
            }
          }
        }

        const groupRecipients = await prisma.recipient.findMany({
          where: {
            userId: campaign.userId,
            ...groupFilter
          },
          orderBy: {
            createdAt: 'asc'
          }
        })

        recipients = groupRecipients
      }

      if (!recipients || recipients.length === 0) {
        throw new Error('收件人列表为空')
      }

      // 获取已发送的数量，支持断点续传
      const sentCount = campaign.sentCount || 0
      const failedCount = campaign.failedCount || 0
      const startIndex = sentCount + failedCount

      console.log(`[CampaignQueue-${this.campaignId}] 从索引 ${startIndex} 开始，共 ${recipients.length} 个收件人`)

      // 批量获取已存在的发送记录，避免在循环中进行大量数据库查询
      // 重要：检查所有可能的状态，包括 processing（预占位状态）
      const recipientEmails = recipients.slice(startIndex).map(r => r.email)
      const existingRecords = await prisma.sentEmail.findMany({
        where: {
          campaignId: campaign.id,
          recipientEmail: { in: recipientEmails },
          status: { in: ['sent', 'delivered', 'pending', 'failed', 'processing'] } // 增加 processing 状态检查
        },
        select: { recipientEmail: true, status: true }
      })

      const existingEmailsSet = new Set(existingRecords.map(r => r.recipientEmail))
      console.log(`[CampaignQueue-${this.campaignId}] 发现 ${existingRecords.length} 个已处理的邮件记录（包括processing状态）`)

      // 预先获取随机问候语，避免在循环中重复查询数据库
      const greeting = await this.getGreeting(campaign.userId)
      console.log(`[CampaignQueue-${this.campaignId}] 使用问候语: ${greeting}`)

      // 为每个收件人创建邮件任务
      for (let i = startIndex; i < recipients.length; i++) {
        const recipient = recipients[i]

        // 检查是否已经存在此收件人的发送记录
        if (existingEmailsSet.has(recipient.email)) {
          console.log(`[CampaignQueue-${this.campaignId}] 收件人 ${recipient.email} 已存在发送记录，跳过`)
          continue
        }

        // 替换邮件内容中的占位符
        let personalizedSubject = campaign.template!.subject
        let personalizedContent = campaign.template!.htmlContent

        // 替换常用占位符
        const replacements: { [key: string]: string } = {
          '{{recipient_name}}': recipient.name || '',
          '{{name}}': recipient.name || '',
          '{{email}}': recipient.email || '',
          '{{greeting}}': greeting,
          '{{timestamp}}': new Date().toLocaleString('zh-CN'),
          '{{date}}': new Date().toLocaleDateString('zh-CN'),
          '{{time}}': new Date().toLocaleTimeString('zh-CN')
        }

        // 替换自定义字段
        Object.keys(recipient).forEach(key => {
          if (key !== 'email' && key !== 'name') {
            replacements[`{{${key}}}`] = (recipient as any)[key] || ''
          }
        })

        // 执行替换
        Object.entries(replacements).forEach(([placeholder, value]) => {
          personalizedSubject = personalizedSubject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value)
          personalizedContent = personalizedContent.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value)
        })

        // 为富文本邮件添加基础CSS样式
        if (campaign.template!.isRichText) {
          personalizedContent = this.addEmailStyles(personalizedContent)
        }

        // 生成邮件唯一ID用于追踪
        const emailId = `${this.campaignId}_${i}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // 添加邮件追踪功能
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        personalizedContent = addEmailTracking(personalizedContent, emailId, baseUrl)

        await this.addEmailTask({
          campaignId: this.campaignId,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          subject: personalizedSubject,
          content: personalizedContent,
          emailProfile: {
            email: campaign.emailProfile!.email,
            password: campaign.emailProfile!.password,
            smtpHost: campaign.emailProfile!.smtpServer,
            smtpPort: campaign.emailProfile!.smtpPort,
            nickname: campaign.emailProfile!.nickname
          },
          maxRetries: 0,
          emailId: emailId
        })
      }

      console.log(`[CampaignQueue-${this.campaignId}] 任务创建完成，共 ${recipients.length - startIndex} 个任务`)

    } catch (error) {
      console.error(`[CampaignQueue-${this.campaignId}] 创建任务失败:`, error)
      throw error
    } finally {
      // 释放添加任务锁
      this.isAddingTasks = false
      console.log(`[CampaignQueue-${this.campaignId}] 任务添加流程结束，释放重入锁`)
    }
  }

  // 消费者工作循环
  private async startConsumer(consumerId: number): Promise<void> {
    // 防止重复启动消费者
    if (this.consumerCount > 0) {
      console.log(`[CampaignQueue-${this.campaignId}] 消费者已在运行 (count=${this.consumerCount})，跳过consumerId=${consumerId}的启动`)
      return
    }

    this.consumerCount++
    console.log(`[CampaignQueue-${this.campaignId}] 启动消费者 ${consumerId}，当前消费者数量: ${this.consumerCount}`)

    while (this._isRunning) {
      try {
        // 检查是否有待处理的任务
        if (this.queue.length === 0) {
          console.log(`[CampaignQueue-${this.campaignId}] 消费者${consumerId} 队列为空，等待新任务...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }

        if (this.processing.size >= this.maxConcurrency) {
          console.log(`[CampaignQueue-${this.campaignId}] 消费者${consumerId} 达到最大并发数，等待...`)
          await new Promise(resolve => setTimeout(resolve, 100))
          continue
        }

        // 获取下一个任务
        const task = this.queue.shift()
        if (!task) {
          await new Promise(resolve => setTimeout(resolve, 100))
          continue
        }

        console.log(`[CampaignQueue-${this.campaignId}] 消费者${consumerId} 获取到任务: ${task.id} -> ${task.recipientEmail}`)

        // 更新活动时间
        this.updateActivity()

        // 先更新统计信息
        this.stats.pending--
        this.stats.processing++
        this.processing.add(task.id)

        // 检查发送间隔
        const now = Date.now()
        const timeSinceLastSend = now - this.lastSendTime

        if (this.lastSendTime > 0) {
          let requiredInterval = 0

          if (this.enableRandomInterval) {
            const minMs = this.randomIntervalMin * 1000
            const maxMs = this.randomIntervalMax * 1000
            requiredInterval = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
            console.log(`[CampaignQueue-${this.campaignId}] 消费者${consumerId} 使用随机间隔: ${Math.round(requiredInterval / 1000)} 秒`)
          } else {
            requiredInterval = this.sendInterval
            console.log(`[CampaignQueue-${this.campaignId}] 消费者${consumerId} 使用固定间隔: ${Math.round(requiredInterval / 1000)} 秒`)
          }

          if (timeSinceLastSend < requiredInterval) {
            const waitTime = requiredInterval - timeSinceLastSend
            console.log(`[CampaignQueue-${this.campaignId}] 消费者${consumerId} 等待发送间隔: ${Math.round(waitTime / 1000)} 秒`)

            // 设置超时强制推进机制，避免长时间卡死
            const maxWaitTime = Math.min(waitTime, 60000) // 最多等待60秒
            if (waitTime > maxWaitTime) {
              console.warn(`[CampaignQueue-${this.campaignId}] 等待时间过长(${Math.round(waitTime / 1000)}秒)，强制推进到下一封邮件`)
            }
            await new Promise(resolve => setTimeout(resolve, maxWaitTime))
          }
        }

        // 更新最后发送时间
        this.lastSendTime = Date.now()

        console.log(`[CampaignQueue-${this.campaignId}] 消费者${consumerId} 开始处理任务: ${task.id}`)

        // 处理任务 - 确保每个任务只处理一次
        this.processEmailTask(task).finally(() => {
          this.processing.delete(task.id)
          this.stats.processing--
          // 更新活动时间
          this.updateActivity()
          console.log(`[CampaignQueue-${this.campaignId}] 消费者${consumerId} 完成任务: ${task.id}`)

          // 检查是否需要检查活动完成状态
          if (this.queue.length === 0 && this.processing.size === 0) {
            console.log(`[CampaignQueue-${this.campaignId}] 队列和处理中任务都为空，检查活动完成状态`)
            this.checkCampaignCompletion().catch(error => {
              console.error(`[CampaignQueue-${this.campaignId}] 检查活动完成状态时出错:`, error)
            })
          }
        })

      } catch (error) {
        console.error(`[CampaignQueue-${this.campaignId}] 消费者 ${consumerId} 错误:`, error)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    this.consumerCount--
    console.log(`[CampaignQueue-${this.campaignId}] 消费者 ${consumerId} 已停止，剩余消费者数量: ${this.consumerCount}`)
  }

  // 处理单个邮件任务
  private async processEmailTask(task: EmailTask): Promise<void> {
    try {
      console.log(`[CampaignQueue-${this.campaignId}] 处理邮件任务: ${task.id} -> ${task.recipientEmail}`)

      // 检查活动状态
      const campaign = await prisma.campaign.findUnique({
        where: { id: task.campaignId },
        select: { id: true, status: true, isPaused: true, userId: true, emailProfileId: true }
      })

      if (!campaign) {
        console.log(`[CampaignQueue-${this.campaignId}] 活动不存在，跳过任务 ${task.id}`)
        this.stats.failed++
        return
      }

      // 检查手动暂停状态，但不自动停止队列，而是跳过当前任务并继续处理其他任务
      if (campaign.isPaused) {
        console.log(`[CampaignQueue-${this.campaignId}] 活动已手动暂停，跳过任务但保持队列运行: ${task.id}`)
        // 记录跳过的任务到失败统计中
        this.stats.failed++

        // 记录暂停跳过日志
        await prisma.campaignLog.create({
          data: {
            campaignId: task.campaignId,
            level: 'info',
            message: `⏸️ 活动暂停期间跳过邮件发送: ${task.recipientEmail}`,
            details: {
              recipientEmail: task.recipientEmail,
              reason: '活动处于暂停状态',
              skippedAt: new Date().toISOString(),
              taskId: task.id
            }
          }
        })

        console.log(`[CampaignQueue-${this.campaignId}] 队列继续运行，不因暂停状态而停止`)
        return
      }

      if (campaign.status === CampaignStatus.STOPPED || campaign.status === CampaignStatus.FAILED) {
        console.log(`[CampaignQueue-${this.campaignId}] 活动已停止，跳过任务 ${task.id}`)
        this.stats.failed++
        return
      }

      // === 原子性预占位逻辑，防止并发重复发送 ===
      let isPreoccupied = false

      // 双重检查：在创建预占位之前，再次确认没有已完成的发送记录
      const existingFinalRecord = await prisma.sentEmail.findFirst({
        where: {
          campaignId: task.campaignId,
          recipientEmail: task.recipientEmail,
          status: { notIn: ['processing'] } // 排除处理中的状态
        },
        select: { id: true, status: true }
      })

      if (existingFinalRecord) {
        console.log(`[CampaignQueue-${this.campaignId}] 双重检查发现已存在最终状态记录: ${task.recipientEmail} (status=${existingFinalRecord.status})，跳过`)
        this.stats.completed++
        return
      }

      if (task.emailId) {
        try {
          // 尝试原子性创建"processing"状态的记录来预占位
          await prisma.sentEmail.create({
            data: {
              id: task.emailId,
              userId: campaign.userId,
              campaignId: task.campaignId,
              emailProfileId: campaign.emailProfileId,
              recipientEmail: task.recipientEmail,
              recipientName: task.recipientName || '',
              subject: task.subject,
              body: task.content,
              status: 'processing', // 临时处理状态
              sentAt: new Date()
            }
          })
          isPreoccupied = true
          console.log(`[CampaignQueue-${this.campaignId}] 成功预占位邮件 ${task.emailId}`)
        } catch (error: any) {
          if (error.code === 'P2002') {
            // 唯一约束冲突，说明邮件已被其他消费者处理或已存在
            console.log(`[CampaignQueue-${this.campaignId}] 邮件 ${task.emailId} 已被预占位或已存在，跳过处理`)
            this.stats.completed++
            return
          }
          throw error // 其他错误继续抛出
        }
      } else {
        // 如果没有 emailId，使用 campaignId + recipientEmail 进行去重检查
        const existingEmail = await prisma.sentEmail.findFirst({
          where: {
            campaignId: task.campaignId,
            recipientEmail: task.recipientEmail
          }
        })

        if (existingEmail) {
          console.log(`[CampaignQueue-${this.campaignId}] 发现重复发送记录: 活动${task.campaignId} -> ${task.recipientEmail}，严格跳过`)
          this.stats.completed++
          return
        }
      }

      // 创建邮件传输器
      const transporter = nodemailer.createTransport({
        host: task.emailProfile.smtpHost,
        port: task.emailProfile.smtpPort,
        secure: task.emailProfile.smtpPort === 465,
        auth: {
          user: task.emailProfile.email,
          pass: task.emailProfile.password
        }
      })

      // 添加开始发送日志到批量队列
      batchDB.addCampaignLog({
        campaignId: task.campaignId,
        level: 'info',
        message: `📧 开始发送邮件: ${task.recipientEmail}`,
        details: {
          recipientEmail: task.recipientEmail,
          recipientName: task.recipientName || '',
          senderEmail: task.emailProfile.email,
          subject: task.subject,
          smtpHost: task.emailProfile.smtpHost,
          smtpPort: task.emailProfile.smtpPort,
          startTime: new Date().toISOString()
        }
      })

      // 添加邮件追踪功能
      let trackedContent = task.content
      if (task.emailId) {
        const { addEmailTracking, extractDomain } = await import('./email-tracking')
        const baseUrl = extractDomain(process.env.NEXTAUTH_URL || 'http://localhost:3000')
        trackedContent = addEmailTracking(task.content, task.emailId, baseUrl)
      }

      // 发送邮件
      const fromAddress = task.emailProfile.nickname
        ? `"${task.emailProfile.nickname}" <${task.emailProfile.email}>`
        : task.emailProfile.email

      console.log(`[CampaignQueue-${this.campaignId}] 正在发送邮件到 ${task.recipientEmail}，发送方: ${fromAddress}`)

      const info = await transporter.sendMail({
        from: fromAddress,
        to: task.recipientEmail,
        subject: task.subject,
        html: trackedContent
      })

      console.log(`[CampaignQueue-${this.campaignId}] 邮件发送完成，MessageID: ${info?.messageId || 'N/A'}`)

      // 使用批量操作优化数据库访问
      if (task.emailId) {
        // 如果之前做了预占位，则直接更新状态为 sent；否则（没有预占位的情况）再进行幂等创建
        try {
          await prisma.sentEmail.update({
            where: { id: task.emailId },
            data: {
              status: 'sent',
              messageId: info?.messageId || null,
              sentAt: new Date()
            }
          })
        } catch (e: any) {
          // 不再进行存在性回查，避免产生额外锁竞争；直接记录警告日志
          console.warn(`[CampaignQueue-${this.campaignId}] 更新sentEmail记录失败（可能未预占位或已被处理）: ${task.emailId}, error: ${e.message}`)
        }

        // 统一统计更新
        batchDB.addCampaignStatsUpdate({
          campaignId: task.campaignId,
          sentCount: 1,
          lastSentAt: new Date()
        })
      }

      // 添加发送成功日志到批量队列
      batchDB.addCampaignLog({
        campaignId: task.campaignId,
        level: 'info',
        message: `✅ 邮件发送成功: ${task.recipientEmail}`,
        details: {
          recipientEmail: task.recipientEmail,
          recipientName: task.recipientName || '',
          senderEmail: task.emailProfile.email,
          messageId: info?.messageId || 'N/A',
          response: info?.response || 'N/A',
          sentAt: new Date().toISOString()
        }
      })

      this.stats.completed++
      console.log(`[CampaignQueue-${this.campaignId}] 邮件发送成功: ${task.recipientEmail}`)

      // 更新活动时间，防止健康检查误判
      this.updateActivity()

      // 检查活动是否完成
      await this.checkCampaignCompletion()

    } catch (error: any) {
      console.error(`[CampaignQueue-${this.campaignId}] 邮件发送失败: ${task.recipientEmail}`, error)

      // 添加发送失败日志到批量队列
      batchDB.addCampaignLog({
        campaignId: task.campaignId,
        level: 'error',
        message: `❌ 邮件发送失败: ${task.recipientEmail}`,
        details: {
          recipientEmail: task.recipientEmail,
          recipientName: task.recipientName || '',
          senderEmail: task.emailProfile.email,
          error: error.message || '未知错误',
          code: error.code || 'N/A',
          command: error.command || 'N/A',
          retryCount: task.retryCount,
          maxRetries: task.maxRetries
        }
      })

      // 失败即跳过策略 - 不进行重试，确保一次发送原则
      console.log(`[CampaignQueue-${this.campaignId}] 邮件发送失败，采用跳过策略: ${task.recipientEmail}`)

      // 直接标记为失败，不重试
      {
        // 使用批量操作检查和创建失败记录或更新预占位
        if (task.emailId) {
          try {
            await prisma.sentEmail.update({
              where: { id: task.emailId },
              data: {
                status: 'failed',
                errorMessage: error.message || '未知错误',
                sentAt: new Date()
              }
            })
          } catch (e: any) {
            // 回退：直接写入批量队列，由 createMany(skipDuplicates) 保证幂等性，避免额外读导致的死锁
            // 获取活动信息
            const campaignInfoMap = await batchDB.getCampaignInfoBatch([task.campaignId])
            const campaignInfo = campaignInfoMap.get(task.campaignId)

            if (campaignInfo) {
              // 添加到批量邮件发送记录队列
              batchDB.addSentEmail({
                id: task.emailId,
                userId: campaignInfo.userId,
                campaignId: task.campaignId,
                emailProfileId: campaignInfo.emailProfileId,
                recipientEmail: task.recipientEmail,
                recipientName: task.recipientName || '',
                subject: task.subject,
                body: task.content,
                status: 'failed',
                sentAt: new Date(),
                errorMessage: error.message
              })
            }
          }

          // 失败统计
          batchDB.addCampaignStatsUpdate({
            campaignId: task.campaignId,
            failedCount: 1
          })

          // 更新Recipient表的失败状态和计数
          try {
            await prisma.recipient.updateMany({
              where: {
                email: task.recipientEmail,
                recipientList: {
                  campaigns: {
                    some: { id: task.campaignId }
                  }
                }
              },
              data: {
                emailStatus: 'FAILED',
                failureCount: { increment: 1 },
                lastFailureReason: error.message || '发送失败',
                lastSentAt: new Date()
              }
            })
            console.log(`[CampaignQueue-${this.campaignId}] 更新收件人 ${task.recipientEmail} 失败状态成功`)
          } catch (recipientUpdateError) {
            console.error(`[CampaignQueue-${this.campaignId}] 更新收件人失败状态时出错:`, recipientUpdateError)
          }
        }

        batchDB.addCampaignLog({
          campaignId: task.campaignId,
          level: 'error',
          message: `⏭️ 邮件发送失败已跳过: ${task.recipientEmail} (一次发送策略)`,
          details: {
            recipientEmail: task.recipientEmail,
            recipientName: task.recipientName || '',
            senderEmail: task.emailProfile.email,
            error: error.message || '未知错误',
            strategy: '失败即跳过，不重试',
            failedAt: new Date().toISOString()
          }
        })

        this.stats.failed++
        console.log(`[CampaignQueue-${this.campaignId}] 任务 ${task.id} 发送失败，已跳过（一次发送策略）`)
      }
    }
  }

  // 检查活动是否完成
  private async checkCampaignCompletion(): Promise<void> {
    try {
      // 添加完成检查冷却期（30秒内不重复检查）
      const now = Date.now()
      if (this.lastCompletionCheckTime > 0 && now - this.lastCompletionCheckTime < 30000) {
        console.log(`[CampaignQueue-${this.campaignId}] 完成检查冷却期内（${Math.round((now - this.lastCompletionCheckTime) / 1000)}秒前检查过），跳过本次检查`)
        return
      }

      // 只有在队列为空且没有处理中任务时才检查完成状态
      if (this.queue.length === 0 && this.processing.size === 0) {
        this.lastCompletionCheckTime = now

        // 强制刷新所有批量操作，确保数据库统计完全同步
        await batchDB.forceFlush()

        // 重新查询数据库中的实际统计数据
        const campaign = await prisma.campaign.findUnique({
          where: { id: this.campaignId },
          select: {
            id: true,
            sentCount: true,
            failedCount: true,
            totalRecipients: true,
            status: true,
            lastSentAt: true
          }
        })

        if (!campaign) {
          console.error(`[CampaignQueue-${this.campaignId}] 活动不存在，无法检查完成状态`)
          return
        }

        // 确保所有邮件都已处理完毕（发送成功或失败）
        const totalProcessed = (campaign.sentCount || 0) + (campaign.failedCount || 0)
        const isAllProcessed = totalProcessed >= (campaign.totalRecipients || 0)

        // 添加额外的安全检查：确保最近有发送活动或者确实没有更多邮件要发送
        const timeSinceLastSent = campaign.lastSentAt ? Date.now() - new Date(campaign.lastSentAt).getTime() : Infinity
        const hasRecentActivity = timeSinceLastSent < 5 * 60 * 1000 // 5分钟内有发送活动

        // 自动完成活动并停止队列
        if (isAllProcessed && campaign.status !== CampaignStatus.COMPLETED && (hasRecentActivity || totalProcessed > 0)) {
          console.log(`[CampaignQueue-${this.campaignId}] 检测到所有任务已完成 (${totalProcessed}/${campaign.totalRecipients}): 成功${campaign.sentCount}, 失败${campaign.failedCount}，自动停止队列并更新状态为COMPLETED`)

          // 更新活动状态为COMPLETED
          await prisma.campaign.update({
            where: { id: this.campaignId },
            data: {
              status: CampaignStatus.COMPLETED,
              completedAt: new Date()
            }
          })

          // 记录完成日志
          await prisma.campaignLog.create({
            data: {
              campaignId: this.campaignId,
              level: 'info',
              message: `活动发送完成，队列已自动停止`,
              details: {
                totalRecipients: campaign.totalRecipients,
                sentCount: campaign.sentCount,
                failedCount: campaign.failedCount,
                successRate: campaign.totalRecipients > 0 ? ((campaign.sentCount || 0) / campaign.totalRecipients * 100).toFixed(1) + '%' : '0%',
                completedAt: new Date().toISOString(),
                note: '队列已自动停止，活动状态已更新为COMPLETED'
              }
            }
          })

          // 自动停止队列
          await this.stop()

          // 从全局队列管理器中移除
          const queueManager = IndependentEmailQueueManager.getInstance()
          await queueManager.stopCampaignQueue(this.campaignId)

          console.log(`[CampaignQueue-${this.campaignId}] 活动已完成，队列已停止并移除`)
        } else if (!isAllProcessed && this.queue.length === 0) {
          // 只有在队列真正为空且未完成的情况下才考虑重新加载，并且需要检查是否刚刚添加过任务
          const timeSinceLastAdd = this.lastTaskAddTime > 0 ? now - this.lastTaskAddTime : Infinity
          if (timeSinceLastAdd > 60000) { // 至少1分钟未添加任务
            console.log(`[CampaignQueue-${this.campaignId}] 队列已空但活动未完成 (${totalProcessed}/${campaign.totalRecipients})，考虑重新加载任务`)
            // 尝试重新加载（addCampaignTasks内部有防重入保护）
            await this.addCampaignTasks()
          } else {
            console.log(`[CampaignQueue-${this.campaignId}] 队列已空但最近${Math.round(timeSinceLastAdd / 1000)}秒前刚添加过任务，等待处理`)
          }
        }
      }
    } catch (error) {
      console.error(`[CampaignQueue-${this.campaignId}] 检查完成状态失败:`, error)
    }
  }

  // 获取队列统计信息
  getStats(): QueueStats & { queueLength: number } {
    return {
      ...this.stats,
      queueLength: this.queue.length
    }
  }

  // 清空队列
  clearQueue(): void {
    const clearedCount = this.queue.length
    this.queue = []
    this.stats.pending = 0
    console.log(`[CampaignQueue-${this.campaignId}] 已清空队列，清除了 ${clearedCount} 个任务`)
  }

  // 获取队列运行状态
  get running(): boolean {
    return this._isRunning
  }

  //// 检查队列是否正在运行
  isRunning(): boolean {
    return this._isRunning
  }

  // 检查队列是否已暂停
  isPaused(): boolean {
    return !this._isRunning && this.queue.length > 0
  }

  // 队列健康检查
  private healthCheckInterval?: NodeJS.Timeout
  private lastActivityTime = Date.now()
  private lastQueueRefreshTime?: number
  private healthCheckIntervalMs = 60 * 1000 // 默认60秒，将根据发送间隔动态调整
  private isPerformingHealthCheck: boolean = false // 健康检查执行标志，防止并发
  private lastCompletionCheckTime: number = 0 // 上次完成检查时间

  // 启动健康检查
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    // 根据发送间隔动态调整健康检查间隔
    // 健康检查间隔 = 发送间隔的一半，最小30秒，最大120秒
    const maxSendInterval = this.enableRandomInterval
      ? this.randomIntervalMax * 1000
      : this.sendInterval

    this.healthCheckIntervalMs = Math.max(
      30 * 1000, // 最小30秒
      Math.min(
        120 * 1000, // 最大120秒
        Math.floor(maxSendInterval / 2) // 发送间隔的一半
      )
    )

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck() // 重新启用健康检查
    }, this.healthCheckIntervalMs)

    console.log(`[CampaignQueue-${this.campaignId}] 启动队列健康检查，检查间隔: ${this.healthCheckIntervalMs / 1000}秒 (基于发送间隔 ${maxSendInterval / 1000}秒 动态调整)`)
  }

  // 停止健康检查
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
      console.log(`[CampaignQueue-${this.campaignId}] 停止队列健康检查`)
    }
  }

  // 执行健康检查 - 分层检测和处理机制
  private async performHealthCheck(): Promise<void> {
    // 防止并发执行健康检查
    if (this.isPerformingHealthCheck) {
      console.log(`[CampaignQueue-${this.campaignId}] 健康检查正在执行中，跳过本次检查`)
      return
    }

    this.isPerformingHealthCheck = true

    try {
      const now = Date.now()
      const timeSinceLastActivity = now - this.lastActivityTime

      // 计算实际的最大发送间隔（考虑固定间隔和随机间隔）
      let maxSendInterval = this.sendInterval // 使用已加载的固定间隔

      if (this.enableRandomInterval && this.randomIntervalMax) {
        // 如果启用随机间隔，使用随机间隔的最大值
        maxSendInterval = this.randomIntervalMax * 1000
      }

      // 智能动态调整检测阈值（完全基于用户设置的发送间隔）
      // 队列刷新阈值：发送间隔的3倍（给予充分的缓冲时间）
      const queueRefreshTime = Math.max(maxSendInterval * 3, 90000) // 至少90秒
      // 强制推进阈值：在刷新基础上再增加发送间隔的2倍
      const forceProgressTime = queueRefreshTime + (maxSendInterval * 2)
      // 消费者重启阈值：在强制推进基础上再增加发送间隔的3倍
      const restartConsumerTime = forceProgressTime + (maxSendInterval * 3)

      console.log(`[CampaignQueue-${this.campaignId}] 健康检查:`, {
        timeSinceLastActivity: Math.round(timeSinceLastActivity / 1000),
        maxSendInterval: Math.round(maxSendInterval / 1000),
        queueRefreshThreshold: Math.round(queueRefreshTime / 1000),
        forceProgressThreshold: Math.round(forceProgressTime / 1000),
        restartThreshold: Math.round(restartConsumerTime / 1000),
        queueLength: this.queue.length,
        processingCount: this.processing.size,
        isRunning: this._isRunning,
        consumerCount: this.consumerCount,
        lastRefreshTime: this.lastQueueRefreshTime ? Math.round((now - this.lastQueueRefreshTime) / 1000) : 'never'
      })

      // 第一层：队列刷新机制（基于用户间隔的动态阈值）
      if (this._isRunning && this.queue.length > 0 && timeSinceLastActivity > queueRefreshTime) {
        const timeSinceLastRefresh = this.lastQueueRefreshTime ? now - this.lastQueueRefreshTime : Infinity

        // 如果距离上次刷新超过阈值，先尝试刷新队列
        if (timeSinceLastRefresh > queueRefreshTime) {
          console.warn(`[CampaignQueue-${this.campaignId}] 检测到队列可能堵塞（无活动${Math.round(timeSinceLastActivity / 1000)}秒，超过阈值${Math.round(queueRefreshTime / 1000)}秒），尝试刷新队列`)
          this.refreshQueue()
        }
      }

      // 第二层：强制推进机制（刷新后仍无效）
      if (this._isRunning && this.queue.length > 0 && timeSinceLastActivity > forceProgressTime) {
        const timeSinceLastRefresh = this.lastQueueRefreshTime ? now - this.lastQueueRefreshTime : 0

        // 如果已经刷新过但仍然堵塞，执行强制推进
        if (timeSinceLastRefresh < restartConsumerTime) { // 在重启阈值内刷新过
          console.warn(`[CampaignQueue-${this.campaignId}] 队列刷新后仍然堵塞（无活动${Math.round(timeSinceLastActivity / 1000)}秒），执行强制推进下一封邮件`)
          this.forceProgressNextEmail()
        } else {
          // 如果很久没有刷新过，先刷新再等待
          console.warn(`[CampaignQueue-${this.campaignId}] 长时间无活动（${Math.round(timeSinceLastActivity / 1000)}秒），先刷新队列`)
          this.refreshQueue()
        }
      }

      // 第三层：消费者重启机制（严重卡死） - 只有在没有消费者运行时才重启
      if (this._isRunning && this.queue.length > 0 && this.processing.size === 0 && this.consumerCount === 0 && timeSinceLastActivity > restartConsumerTime) {
        console.error(`[CampaignQueue-${this.campaignId}] 队列严重卡死（无活动${Math.round(timeSinceLastActivity / 1000)}秒，超过阈值${Math.round(restartConsumerTime / 1000)}秒），重启消费者`)
        console.log(`[CampaignQueue-${this.campaignId}] 队列状态: 任务数=${this.queue.length}, 处理中=${this.processing.size}, 消费者数=${this.consumerCount}, 最大间隔=${Math.round(maxSendInterval / 1000)}秒`)

        // 重启消费者
        await this.restartConsumer()
      }

      // 检查活动状态（仅记录状态，不执行任何自动停止操作）
      const campaignStatus = await prisma.campaign.findUnique({
        where: { id: this.campaignId },
        select: { status: true, isPaused: true }
      })

      if (campaignStatus) {
        if (campaignStatus.status === CampaignStatus.STOPPED || campaignStatus.status === CampaignStatus.FAILED) {
          console.log(`[CampaignQueue-${this.campaignId}] 活动状态已变更为 ${campaignStatus.status}，但队列继续运行（仅手动控制）`)
          // 移除自动停止逻辑，只允许手动控制
        } else if (campaignStatus.isPaused && this._isRunning) {
          console.log(`[CampaignQueue-${this.campaignId}] 活动被手动暂停，但队列继续运行（任务将被跳过）`)
          // 不再自动暂停队列，让队列继续运行但跳过暂停期间的任务
        }
      }

    } catch (error) {
      console.error(`[CampaignQueue-${this.campaignId}] 健康检查失败:`, error)
    } finally {
      this.isPerformingHealthCheck = false
    }
  }

  // 重启消费者
  private async restartConsumer(): Promise<void> {
    try {
      console.log(`[CampaignQueue-${this.campaignId}] 重启消费者，当前消费者数量: ${this.consumerCount}`)

      // 如果消费者已在运行，不重复启动
      if (this.consumerCount > 0) {
        console.log(`[CampaignQueue-${this.campaignId}] 消费者已在运行 (count=${this.consumerCount})，无需重启`)
        return
      }

      // 清理处理中的任务
      this.processing.clear()
      this.stats.processing = 0

      // 更新活动时间
      this.updateActivity()

      // 重新启动消费者
      this.startConsumer(0)

      console.log(`[CampaignQueue-${this.campaignId}] 消费者重启完成`)
    } catch (error) {
      console.error(`[CampaignQueue-${this.campaignId}] 重启消费者失败:`, error)
    }
  }

  // 更新活动时间
  private updateActivity(): void {
    this.lastActivityTime = Date.now()
  }

  // 检查队列是否真的堵塞
  private isQueueStuck(campaignId: string): boolean {
    // 如果队列为空或没有运行，不算堵塞
    if (this.queue.length === 0 || !this._isRunning) {
      return false
    }

    // 如果有任务在处理中，说明队列在工作
    if (this.processing.size > 0) {
      return false
    }

    // 检查是否有可处理的任务
    const now = Date.now()
    const hasReadyTasks = this.queue.some(task => {
      // 检查任务是否已经可以发送（考虑发送间隔）
      const timeSinceLastSend = now - this.lastSendTime
      return timeSinceLastSend >= this.sendInterval
    })

    // 只有当有可处理的任务但没有在处理时，才认为是堵塞
    return hasReadyTasks
  }

  // 刷新队列状态
  private refreshQueue(): void {
    console.log(`[CampaignQueue-${this.campaignId}] 刷新队列状态（基于用户发送间隔的智能检测）`)

    this.lastQueueRefreshTime = Date.now()
    this.updateActivity()

    // 清理可能卡住的处理中任务
    if (this.processing.size > 0) {
      console.warn(`[CampaignQueue-${this.campaignId}] 清理处理中任务: ${this.processing.size} 个`)
      this.processing.clear()
      this.stats.processing = 0
    }

    console.log(`[CampaignQueue-${this.campaignId}] 队列刷新完成，等待队列数: ${this.queue.length}`)
  }

  // 强制推进下一封邮件 - 跳过当前可能卡住的邮件
  private forceProgressNextEmail(): void {
    console.log(`[CampaignQueue-${this.campaignId}] 强制推进下一封邮件（重置策略，不跳过邮件）`)

    // 清理可能卡住的处理中任务，但不重置发送时间
    if (this.processing.size > 0) {
      console.warn(`[CampaignQueue-${this.campaignId}] 清理卡住的处理中任务: ${Array.from(this.processing).join(', ')}`)
      this.processing.clear()
      this.stats.processing = 0
    }

    // 重置发送时间限制，允许立即发送下一封邮件
    if (this.queue.length > 0) {
      console.log(`[CampaignQueue-${this.campaignId}] 重置发送时间限制，允许立即发送下一封邮件`)
      this.lastSendTime = 0 // 重置发送时间，允许立即发送

      // 记录强制推进日志
      batchDB.addCampaignLog({
        campaignId: this.campaignId,
        level: 'info',
        message: `🚀 队列堵塞强制推进，重置发送时间限制`,
        details: {
          queueLength: this.queue.length,
          reason: '队列堵塞强制推进',
          resetAt: new Date().toISOString()
        }
      })
    }

    this.updateActivity()

    // 如果队列不在运行状态，尝试重新启动消费者
    if (!this._isRunning && this.queue.length > 0) {
      console.log(`[CampaignQueue-${this.campaignId}] 队列未运行但有任务，自动重启消费者`)
      this._isRunning = true
      this.startConsumer(0)
    }

    console.log(`[CampaignQueue-${this.campaignId}] 强制推进完成，剩余队列数: ${this.queue.length}`)
  }

  // 自动强制推进队列（系统内部调用，保持向后兼容）
  private autoForceProgress(): void {
    this.forceProgressNextEmail()
  }

  // 手动刷新队列，强制推进下一个任务（保留给管理员使用）
  public forceProgress(): void {
    console.log(`[CampaignQueue-${this.campaignId}] 手动强制推进队列（管理员操作）`)
    this.forceProgressNextEmail()
  }

  // 为富文本邮件添加基础CSS样式
  private addEmailStyles(htmlContent: string): string {
    const emailStyles = `
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #374151;
          max-width: 100%;
          margin: 0;
          padding: 20px;
        }
        p {
          margin: 0 0 1em 0;
          line-height: 1.6;
        }
        h1, h2, h3, h4, h5, h6 {
          margin: 1.5em 0 0.5em 0;
          line-height: 1.3;
        }
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        ul, ol {
          margin: 1em 0;
          padding-left: 2em;
        }
        li {
          margin: 0.5em 0;
        }
        blockquote {
          margin: 1em 0;
          padding: 0.5em 1em;
          border-left: 4px solid #e5e7eb;
          background-color: #f9fafb;
        }
        a {
          color: #3b82f6;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        strong {
          font-weight: 600;
        }
        em {
          font-style: italic;
        }
        .placeholder {
          background-color: #e0f2fe;
          color: #0369a1;
          padding: 2px 4px;
          border-radius: 3px;
          font-weight: 500;
          border: 1px solid #38bdf8;
        }
      </style>
    `

    if (htmlContent.includes('<html>') || htmlContent.includes('<body>')) {
      return htmlContent.replace(/<head[^>]*>/i, `$&${emailStyles}`)
    } else {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${emailStyles}
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `
    }
  }

  // 生成问候语
  private async getGreeting(userId?: string): Promise<string> {
    try {
      const userGreetings = await prisma.greeting.findMany({
        where: {
          userId: userId,
          isActive: true,
          isDefault: false
        }
      })

      const hiddenDefaultContents = await prisma.greeting.findMany({
        where: {
          userId: userId,
          isDefault: false,
          isActive: false
        },
        select: {
          content: true
        }
      })

      const hiddenContents = hiddenDefaultContents.map(g => g.content)

      const defaultGreetings = await prisma.greeting.findMany({
        where: {
          userId: null,
          isDefault: true,
          isActive: true,
          content: {
            notIn: hiddenContents
          }
        }
      })

      const allGreetings = [...userGreetings, ...defaultGreetings]

      if (allGreetings.length > 0) {
        const randomIndex = Math.floor(Math.random() * allGreetings.length)
        return allGreetings[randomIndex].content
      }
    } catch (error) {
      console.error('获取随机问候语失败:', error)
    }

    // 默认问候语
    const hour = new Date().getHours()
    if (hour < 6) {
      return '夜深了'
    } else if (hour < 9) {
      return '早上好'
    } else if (hour < 12) {
      return '上午好'
    } else if (hour < 14) {
      return '中午好'
    } else if (hour < 18) {
      return '下午好'
    } else if (hour < 22) {
      return '晚上好'
    } else {
      return '夜深了'
    }
  }
}

// 独立队列管理器
export class IndependentEmailQueueManager {
  private static instance: IndependentEmailQueueManager
  private campaignQueues: Map<string, CampaignQueue> = new Map()
  private globalStats = { totalCampaigns: 0, activeCampaigns: 0 }

  static getInstance(): IndependentEmailQueueManager {
    if (!IndependentEmailQueueManager.instance) {
      IndependentEmailQueueManager.instance = new IndependentEmailQueueManager()
    }
    return IndependentEmailQueueManager.instance
  }

  // 为活动创建独立队列
  async createCampaignQueue(campaignId: string, concurrency: number = 1): Promise<CampaignQueue> {
    if (this.campaignQueues.has(campaignId)) {
      console.log(`[IndependentQueueManager] 活动 ${campaignId} 的队列已存在`)
      return this.campaignQueues.get(campaignId)!
    }

    const queue = new CampaignQueue(campaignId)
    this.campaignQueues.set(campaignId, queue)
    this.globalStats.totalCampaigns++

    console.log(`[IndependentQueueManager] 为活动 ${campaignId} 创建独立队列（单线程模式），当前总队列数: ${this.campaignQueues.size}`)

    return queue
  }

  // 启动活动队列
  async startCampaignQueue(campaignId: string, concurrency: number = 1): Promise<{ success: boolean; error?: string }> {
    try {
      // === 数据库级别的乐观锁 - 防止并发重复启动 ===
      const lockToken = `start_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 首先检查活动当前状态
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true, recoveryToken: true, recoveryExpiresAt: true }
      })

      // 如果已经在发送中，直接返回成功（幂等性）
      if (campaign?.status === CampaignStatus.SENDING) {
        console.log(`[IndependentQueueManager] 活动 ${campaignId} 数据库状态已为SENDING，跳过重复启动`)
        return { success: true }
      }

      // 尝试获取启动锁（使用数据库原子操作保证并发安全）
      const lockResult = await prisma.campaign.updateMany({
        where: {
          id: campaignId,
          status: { not: CampaignStatus.SENDING },
          OR: [
            { recoveryToken: null },
            { recoveryToken: '' },
            { recoveryExpiresAt: { lt: new Date() } }
          ]
        },
        data: {
          recoveryToken: lockToken,
          recoveryExpiresAt: new Date(Date.now() + 120000) // 120秒锁超时
        }
      })

      if (lockResult.count === 0) {
        console.log(`[IndependentQueueManager] 无法获取启动锁，活动 ${campaignId} 可能正被其他进程处理`)
        // 返回成功，因为其他进程正在处理
        return { success: true }
      }

      console.log(`[IndependentQueueManager] 成功获取活动 ${campaignId} 的启动锁: ${lockToken}`)

      let queue = this.campaignQueues.get(campaignId)

      // 检查队列是否已经在运行
      if (queue && queue.isRunning()) {
        console.log(`[IndependentQueueManager] 活动 ${campaignId} 的队列已在运行中，跳过重复启动`)
        // 释放锁
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { recoveryToken: null, recoveryExpiresAt: null }
        })
        return { success: true }
      }

      if (!queue) {
        queue = await this.createCampaignQueue(campaignId, 1) // 强制使用单线程

        // 更新活动状态为SENDING
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: CampaignStatus.SENDING,
            isPaused: false,
            recoveryToken: null, // 清除启动锁
            recoveryExpiresAt: null
          }
        })
        console.log(`[IndependentQueueManager] 活动 ${campaignId} 状态已更新为 SENDING`)
        await prisma.campaignLog.create({
          data: {
            campaignId,
            level: 'info',
            message: '队列已启动（创建）',
            details: { action: 'start_queue', source: 'independent_email_queue', lockToken, at: new Date().toISOString() }
          }
        })
        // 添加活动任务（只在新创建队列时添加）
        await queue.addCampaignTasks()

        // 启动队列（单线程模式）
        await queue.start(1)

        this.globalStats.activeCampaigns++
        console.log(`[IndependentQueueManager] 启动活动 ${campaignId} 的独立队列（单线程发送模式），活跃队列数: ${this.globalStats.activeCampaigns}`)
      } else {
        // 队列存在但未运行，恢复队列并重新加载任务
        console.log(`[IndependentQueueManager] 恢复活动 ${campaignId} 的队列，当前队列长度: ${queue.getStats().queueLength}`)

        // 如果队列为空，重新添加任务
        if (queue.getStats().queueLength === 0) {
          console.log(`[IndependentQueueManager] 队列为空，重新加载活动 ${campaignId} 的任务`)
          await queue.addCampaignTasks()
        }

        // 更新活动状态为SENDING
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: CampaignStatus.SENDING,
            isPaused: false,
            recoveryToken: null, // 清除启动锁
            recoveryExpiresAt: null
          }
        })

        await queue.resume()
        console.log(`[IndependentQueueManager] 恢复活动 ${campaignId} 的队列`)
        await prisma.campaignLog.create({
          data: {
            campaignId,
            level: 'info',
            message: '队列已恢复',
            details: { action: 'resume_queue', source: 'independent_email_queue', lockToken, at: new Date().toISOString() }
          }
        })
      }

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[IndependentQueueManager] 启动活动 ${campaignId} 队列失败:`, errorMessage)
      // 尝试清理锁
      try {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { recoveryToken: null, recoveryExpiresAt: null }
        })
      } catch (cleanupError) {
        console.error(`[IndependentQueueManager] 清理启动锁失败:`, cleanupError)
      }
      return { success: false, error: errorMessage }
    }
  }

  // 停止活动队列
  async stopCampaignQueue(campaignId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const queue = this.campaignQueues.get(campaignId)
      if (queue) {
        await queue.stop()
        this.campaignQueues.delete(campaignId)
        this.globalStats.activeCampaigns = Math.max(0, this.globalStats.activeCampaigns - 1)
        console.log(`[IndependentQueueManager] 停止并移除活动 ${campaignId} 的队列，剩余队列数: ${this.campaignQueues.size}`)
        await prisma.campaignLog.create({
          data: {
            campaignId,
            level: 'info',
            message: '队列已停止并移除',
            details: { action: 'stop_queue', source: 'independent_email_queue', at: new Date().toISOString() }
          }
        })
        return { success: true }
      } else {
        console.log(`[IndependentQueueManager] 活动 ${campaignId} 的队列不存在，可能已被清理`)
        return { success: true } // 队列不存在也算成功
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[IndependentQueueManager] 停止活动 ${campaignId} 队列失败:`, errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // 暂停活动队列
  async pauseCampaignQueue(campaignId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const queue = this.campaignQueues.get(campaignId)
      if (queue) {
        await queue.pause()
        console.log(`[IndependentQueueManager] 暂停活动 ${campaignId} 的队列`)
        await prisma.campaignLog.create({
          data: {
            campaignId,
            level: 'info',
            message: '队列已暂停',
            details: { action: 'pause_queue', source: 'independent_email_queue', at: new Date().toISOString() }
          }
        })
        return { success: true }
      } else {
        return { success: false, error: '队列不存在' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[IndependentQueueManager] 暂停活动 ${campaignId} 队列失败:`, errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // 恢复活动队列
  async resumeCampaignQueue(campaignId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[IndependentQueueManager] 开始恢复活动 ${campaignId} 的队列`)

      // 首先检查活动是否存在且状态正确
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, status: true, isPaused: true, name: true }
      })

      if (!campaign) {
        const error = `活动 ${campaignId} 不存在`
        console.error(`[IndependentQueueManager] ${error}`)
        return { success: false, error }
      }

      console.log(`[IndependentQueueManager] 活动 ${campaignId} 当前状态: ${campaign.status}, isPaused: ${campaign.isPaused}`)

      const queue = this.campaignQueues.get(campaignId)
      if (queue) {
        // 检查队列当前状态
        const isRunning = queue.isRunning()
        const queueStats = queue.getStats()
        console.log(`[IndependentQueueManager] 队列状态 - 运行中: ${isRunning}, 任务数: ${queueStats.queueLength}, 处理中: ${queueStats.processing}`)

        // 如果队列已在运行，直接返回成功
        if (isRunning) {
          console.log(`[IndependentQueueManager] 活动 ${campaignId} 队列已在运行中，无需恢复`)
          return { success: true, error: '队列已在运行中' }
        }

        // 更新活动状态为SENDING
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: CampaignStatus.SENDING,
            isPaused: false
          }
        })
        console.log(`[IndependentQueueManager] 活动 ${campaignId} 状态已更新为 SENDING`)

        // 检查队列中是否还有任务，如果没有则重新添加任务
        if (queueStats.queueLength === 0) {
          console.log(`[IndependentQueueManager] 队列为空，重新添加活动 ${campaignId} 的任务`)
          try {
            await queue.addCampaignTasks()
            const newStats = queue.getStats()
            console.log(`[IndependentQueueManager] 已添加 ${newStats.queueLength} 个任务到队列`)
          } catch (addTaskError) {
            const error = `添加任务失败: ${addTaskError instanceof Error ? addTaskError.message : String(addTaskError)}`
            console.error(`[IndependentQueueManager] ${error}`)
            return { success: false, error }
          }
        }

        // 恢复队列
        try {
          await queue.resume()
          console.log(`[IndependentQueueManager] 成功恢复活动 ${campaignId} 的队列`)

          // 记录成功日志
          await prisma.campaignLog.create({
            data: {
              campaignId,
              level: 'info',
              message: '队列已恢复',
              details: {
                action: 'resume_queue',
                source: 'independent_email_queue',
                queueLength: queue.getStats().queueLength,
                at: new Date().toISOString()
              }
            }
          })

          return { success: true }
        } catch (resumeError) {
          const error = `恢复队列失败: ${resumeError instanceof Error ? resumeError.message : String(resumeError)}`
          console.error(`[IndependentQueueManager] ${error}`)
          return { success: false, error }
        }
      } else {
        // 如果队列不存在，尝试重新创建并启动
        console.log(`[IndependentQueueManager] 队列不存在，重新创建活动 ${campaignId} 的队列`)
        try {
          const result = await this.startCampaignQueue(campaignId)
          if (result.success) {
            console.log(`[IndependentQueueManager] 成功重新创建并启动活动 ${campaignId} 的队列`)
          } else {
            console.error(`[IndependentQueueManager] 重新创建队列失败: ${result.error}`)
          }
          return result
        } catch (startError) {
          const error = `重新创建队列失败: ${startError instanceof Error ? startError.message : String(startError)}`
          console.error(`[IndependentQueueManager] ${error}`)
          return { success: false, error }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[IndependentQueueManager] 恢复活动 ${campaignId} 队列失败:`, errorMessage)

      // 记录错误日志
      try {
        await prisma.campaignLog.create({
          data: {
            campaignId,
            level: 'error',
            message: '队列恢复失败',
            details: {
              action: 'resume_queue_failed',
              source: 'independent_email_queue',
              error: errorMessage,
              at: new Date().toISOString()
            }
          }
        })
      } catch (logError) {
        console.error(`[IndependentQueueManager] 记录错误日志失败:`, logError)
      }

      return { success: false, error: errorMessage }
    }
  }

  // 获取活动队列
  getCampaignQueue(campaignId: string): CampaignQueue | undefined {
    return this.campaignQueues.get(campaignId)
  }

  // 检查队列是否正在运行
  isQueueRunning(campaignId: string): boolean {
    const queue = this.campaignQueues.get(campaignId)
    return queue ? queue.isRunning() : false
  }

  // 强制推进指定活动的队列
  async forceProgressCampaign(campaignId: string): Promise<void> {
    const queue = this.campaignQueues.get(campaignId)
    if (queue) {
      console.log(`[IndependentQueueManager] 强制推进活动 ${campaignId} 的队列`)
      queue.forceProgress()
    } else {
      console.warn(`[IndependentQueueManager] 活动 ${campaignId} 的队列不存在，无法强制推进`)
      throw new Error(`活动 ${campaignId} 的队列不存在`)
    }
  }

  // 获取所有活动队列的统计信息
  getAllStats(): { [campaignId: string]: QueueStats & { queueLength: number } } {
    const stats: { [campaignId: string]: QueueStats & { queueLength: number } } = {}

    this.campaignQueues.forEach((queue, campaignId) => {
      stats[campaignId] = queue.getStats()
    })

    return stats
  }

  // 获取全局统计信息
  getGlobalStats() {
    return {
      ...this.globalStats,
      activeQueues: this.campaignQueues.size,
      totalQueues: this.globalStats.totalCampaigns
    }
  }

  // 停止所有队列
  async stopAllQueues(): Promise<void> {
    console.log(`[IndependentQueueManager] 开始停止所有队列，当前队列数: ${this.campaignQueues.size}`)

    const stopPromises: Promise<void>[] = []

    for (const [campaignId, queue] of this.campaignQueues.entries()) {
      stopPromises.push(
        queue.stop().then(() => {
          console.log(`[IndependentQueueManager] 已停止队列: ${campaignId}`)
        }).catch((error) => {
          console.error(`[IndependentQueueManager] 停止队列 ${campaignId} 失败:`, error)
        })
      )
    }

    // 等待所有队列停止
    await Promise.all(stopPromises)

    // 清空队列映射
    this.campaignQueues.clear()
    this.globalStats.activeCampaigns = 0

    console.log(`[IndependentQueueManager] 所有队列已停止并清理完成`)
  }

  // 刷新活动队列
  async refreshCampaignQueue(campaignId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const queue = this.campaignQueues.get(campaignId)
      if (!queue) {
        return { success: false, error: '队列不存在' }
      }

      console.log(`[IndependentQueueManager] 开始刷新活动 ${campaignId} 的队列`)

      // 清空现有队列，避免重复任务
      queue.clearQueue()
      console.log(`[IndependentQueueManager] 已清空活动 ${campaignId} 的现有队列`)

      // 重新加载活动任务
      await queue.addCampaignTasks()

      // 如果队列已暂停，尝试恢复
      if (!queue.isRunning()) {
        await queue.resume()
        console.log(`[IndependentQueueManager] 队列已恢复运行: ${campaignId}`)
      }

      console.log(`[IndependentQueueManager] 成功刷新活动 ${campaignId} 的队列`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[IndependentQueueManager] 刷新活动 ${campaignId} 队列失败:`, errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // 清理已完成的队列
  async cleanupCompletedQueues(): Promise<void> {
    const completedCampaigns: string[] = []

    for (const [campaignId, queue] of this.campaignQueues.entries()) {
      if (!queue.running) {
        const stats = queue.getStats()
        if (stats.queueLength === 0 && stats.processing === 0) {
          completedCampaigns.push(campaignId)
        }
      }
    }

    for (const campaignId of completedCampaigns) {
      this.campaignQueues.delete(campaignId)
      console.log(`[IndependentQueueManager] 清理已完成的队列: ${campaignId}`)
    }

    if (completedCampaigns.length > 0) {
      console.log(`[IndependentQueueManager] 清理了 ${completedCampaigns.length} 个已完成的队列，剩余: ${this.campaignQueues.size}`)
    }
  }
}

// 导出单例实例
export const independentEmailQueueManager = IndependentEmailQueueManager.getInstance()