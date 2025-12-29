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
    nickname?: string // 发件人姓名
  }
  retryCount: number
  maxRetries: number
  createdAt: Date
  emailId?: string // 用于追踪的邮件ID
}

// 队列状态
interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
}

// 邮件队列服务
export class EmailQueueService {
  private static instance: EmailQueueService
  private queue: EmailTask[] = []
  private processing: Set<string> = new Set()
  private isRunning = false
  private consumers: number = 1 // 默认1个消费者
  private maxConcurrency = 10 // 最大并发数，支持更多任务
  private sendInterval = 1000 // 默认发送间隔（毫秒）
  private stats: QueueStats = { pending: 0, processing: 0, completed: 0, failed: 0 }
  private lastSendTime = 0 // 全局最后发送时间，确保所有消费者遵守间隔
  // 活动任务映射
  private campaignTasks: Map<string, Set<string>> = new Map()
  // 每个活动的最后发送时间
  private campaignLastSendTime: Map<string, number> = new Map()
  // 每个活动的发送锁
  private campaignSendingLocks: Map<string, boolean> = new Map()
  
  static getInstance(): EmailQueueService {
    if (!EmailQueueService.instance) {
      EmailQueueService.instance = new EmailQueueService()
    }
    return EmailQueueService.instance
  }

  // 启动队列消费者
  async start(concurrency: number = 3) {
    if (this.isRunning) {
      console.log('[EmailQueue] 队列已在运行中')
      return
    }

    this.maxConcurrency = concurrency
    this.isRunning = true
    
    console.log(`[EmailQueue] 启动邮件队列服务，并发数: ${concurrency}`)
    
    // 启动多个消费者
    for (let i = 0; i < concurrency; i++) {
      this.startConsumer(i)
    }
  }

  // 停止队列
  async stop() {
    this.isRunning = false
    // 强制刷新所有批量操作
    await batchDB.forceFlush()
    console.log('[EmailQueue] 停止邮件队列服务，批量操作已刷新')
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
    
    // 记录活动任务
    if (!this.campaignTasks.has(task.campaignId)) {
      this.campaignTasks.set(task.campaignId, new Set())
    }
    this.campaignTasks.get(task.campaignId)!.add(emailTask.id)
    
    console.log(`[EmailQueue] 添加邮件任务: ${emailTask.id}, 队列长度: ${this.queue.length}`)
    return emailTask.id
  }

  // 批量添加活动的所有邮件任务
  async addCampaignTasks(campaignId: string): Promise<void> {
    try {
      console.log(`[EmailQueue] 开始为活动 ${campaignId} 创建邮件任务`)
      
      // 获取活动信息
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
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
        throw new Error(`活动 ${campaignId} 不存在`)
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
          // 解析存储的JSON字符串
          const selectedGroups = typeof campaign.selectedGroups === 'string' 
            ? JSON.parse(campaign.selectedGroups) 
            : campaign.selectedGroups
          
          groupFilter = {
            group: {
              in: selectedGroups
            }
          }
        } else {
          // 所有分组模式，排除没有分组的收件人
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
        
        // 从数据库获取分组收件人
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

      console.log(`[EmailQueue] 活动 ${campaignId} 从索引 ${startIndex} 开始，共 ${recipients.length} 个收件人`)

      // 为每个收件人创建邮件任务
      for (let i = startIndex; i < recipients.length; i++) {
        const recipient = recipients[i]
        
        // 检查是否已经存在此收件人的发送记录，避免重复添加任务
        const existingRecord = await prisma.sentEmail.findFirst({
          where: {
            campaignId: campaign.id,
            recipientEmail: recipient.email,
            status: { in: ['sent', 'delivered', 'pending', 'failed'] } // 包含所有已处理状态
          }
        })
        
        if (existingRecord) {
          console.log(`[EmailQueue] 收件人 ${recipient.email} 已存在发送记录，跳过任务添加`)
          continue
        }
        
        // 替换邮件内容中的占位符
        let personalizedSubject = campaign.template!.subject
        let personalizedContent = campaign.template!.htmlContent
        
        // 获取随机问候语
        const greeting = await this.getGreeting(campaign.userId)
        
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
        
        // 替换自定义字段（如果收件人数据中有其他字段）
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
        
        // 为富文本邮件添加基础CSS样式，确保段落间距与编辑器预览一致
        if (campaign.template!.isRichText) {
          personalizedContent = this.addEmailStyles(personalizedContent)
        }
        
        // 生成邮件唯一ID用于追踪
        const emailId = `${campaignId}_${i}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // 添加邮件追踪功能（打开追踪和链接点击追踪）
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        personalizedContent = addEmailTracking(personalizedContent, emailId, baseUrl)
        
        await this.addEmailTask({
          campaignId,
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

      console.log(`[EmailQueue] 活动 ${campaignId} 任务创建完成，共 ${recipients.length - startIndex} 个任务`)
      
    } catch (error) {
      console.error(`[EmailQueue] 创建活动任务失败 ${campaignId}:`, error)
      throw error
    }
  }

  // 暂停活动的所有任务
  async pauseCampaign(campaignId: string): Promise<void> {
    console.log(`[EmailQueue] 暂停活动 ${campaignId} 的所有任务`)
    
    // 从队列中移除该活动的待处理任务
    const tasksToRemove = this.queue.filter(task => task.campaignId === campaignId)
    this.queue = this.queue.filter(task => task.campaignId !== campaignId)
    this.stats.pending -= tasksToRemove.length
    
    // 清理活动任务映射
    this.campaignTasks.delete(campaignId)
    
    console.log(`[EmailQueue] 活动 ${campaignId} 已暂停，移除 ${tasksToRemove.length} 个待处理任务`)
  }

  // 获取队列统计信息
  getStats(): QueueStats & { queueLength: number } {
    return {
      ...this.stats,
      queueLength: this.queue.length
    }
  }

  // 获取队列运行状态
  get running(): boolean {
    return this.isRunning
  }

  // 获取活动的任务状态
  getCampaignTaskCount(campaignId: string): number {
    return this.campaignTasks.get(campaignId)?.size || 0
  }

  // 为富文本邮件添加基础CSS样式
  private addEmailStyles(htmlContent: string): string {
    // 定义邮件基础样式，确保与编辑器预览一致
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
    
    // 检查HTML是否已经包含完整的HTML结构
    if (htmlContent.includes('<html>') || htmlContent.includes('<body>')) {
      // 如果已经是完整的HTML文档，在head中插入样式
      return htmlContent.replace(/<head[^>]*>/i, `$&${emailStyles}`)
    } else {
      // 如果只是HTML片段，包装成完整的HTML文档
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

  // 生成问候语 - 从数据库获取随机问候语
  private async getGreeting(userId?: string): Promise<string> {
    try {
      // 获取用户自定义问候语
      const userGreetings = await prisma.greeting.findMany({
        where: {
          userId: userId,
          isActive: true,
          isDefault: false
        }
      })

      // 获取用户隐藏的默认问候语内容列表
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

      // 获取默认问候语（排除用户隐藏的）
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

      // 合并用户自定义问候语和可用的默认问候语
      const allGreetings = [...userGreetings, ...defaultGreetings]

      if (allGreetings.length > 0) {
        // 随机选择一个问候语
        const randomIndex = Math.floor(Math.random() * allGreetings.length)
        return allGreetings[randomIndex].content
      }
    } catch (error) {
      console.error('获取随机问候语失败:', error)
    }

    // 如果没有找到问候语或出错，返回基于时间的默认问候语
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

  // 消费者工作循环
  private async startConsumer(consumerId: number): Promise<void> {
    console.log(`[EmailQueue] 启动消费者 ${consumerId}`)
    
    while (this.isRunning) {
      try {
        // 检查是否有待处理的任务
        if (this.queue.length === 0 || this.processing.size >= this.maxConcurrency) {
          await new Promise(resolve => setTimeout(resolve, 100))
          continue
        }

        // 查找可以处理的任务（没有被锁定的活动）
        let taskIndex = -1
        let task: EmailTask | null = null
        
        for (let i = 0; i < this.queue.length; i++) {
          const currentTask = this.queue[i]
          const campaignLocked = this.campaignSendingLocks.get(currentTask.campaignId) || false
          
          if (!campaignLocked) {
            taskIndex = i
            task = currentTask
            break
          }
        }
        
        if (!task || taskIndex === -1) {
          await new Promise(resolve => setTimeout(resolve, 100))
          continue
        }
        
        // 从队列中移除任务
        this.queue.splice(taskIndex, 1)

        // 获取该活动的发送锁
        this.campaignSendingLocks.set(task.campaignId, true)

        // 检查该活动的发送间隔
        const now = Date.now()
        const campaignLastSend = this.campaignLastSendTime.get(task.campaignId) || 0
        const timeSinceLastSend = now - campaignLastSend
        
        // 获取活动的间隔设置
        const campaign = await prisma.campaign.findUnique({
          where: { id: task.campaignId },
          select: {
            enableRandomInterval: true,
            randomIntervalMin: true,
            randomIntervalMax: true
          }
        })
        
        if (campaign && campaignLastSend > 0) {
          let requiredInterval = 0
          
          // 详细日志：显示活动的间隔配置
          console.log(`[EmailQueue] 消费者${consumerId} 活动${task.campaignId} 间隔配置:`, {
            enableRandomInterval: campaign.enableRandomInterval,
            randomIntervalMin: campaign.randomIntervalMin,
            randomIntervalMax: campaign.randomIntervalMax
          })
          
          if (campaign.enableRandomInterval && campaign.randomIntervalMin && campaign.randomIntervalMax) {
            // 使用随机间隔
            const minMs = campaign.randomIntervalMin * 1000
            const maxMs = campaign.randomIntervalMax * 1000
            requiredInterval = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
            console.log(`[EmailQueue] 消费者${consumerId} 活动${task.campaignId} 使用随机间隔: ${Math.round(requiredInterval/1000)} 秒 (范围: ${campaign.randomIntervalMin}-${campaign.randomIntervalMax}秒)`)
          } else {
              // 使用默认间隔（60秒）
              requiredInterval = 60 * 1000
              console.log(`[EmailQueue] 消费者${consumerId} 活动${task.campaignId} 使用默认间隔: ${Math.round(requiredInterval/1000)} 秒`)
            }
          
          if (requiredInterval > 0 && timeSinceLastSend < requiredInterval) {
            const waitTime = requiredInterval - timeSinceLastSend
            console.log(`[EmailQueue] 消费者${consumerId} 活动${task.campaignId} 等待发送间隔: ${Math.round(waitTime/1000)} 秒 (上次发送: ${Math.round(timeSinceLastSend/1000)} 秒前)`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
          } else {
            console.log(`[EmailQueue] 消费者${consumerId} 活动${task.campaignId} 无需等待 (间隔: ${Math.round(requiredInterval/1000)}秒, 已过: ${Math.round(timeSinceLastSend/1000)}秒)`)
          }
        }
        
        // 更新该活动的最后发送时间
        this.campaignLastSendTime.set(task.campaignId, Date.now())

        this.stats.pending--
        this.stats.processing++
        this.processing.add(task.id)

        // 处理任务（移除间隔逻辑）
        this.processEmailTask(task, false).finally(() => {
          this.processing.delete(task.id)
          this.stats.processing--
          // 释放该活动的发送锁
          this.campaignSendingLocks.set(task.campaignId, false)
        })
        
      } catch (error) {
        console.error(`[EmailQueue] 消费者 ${consumerId} 错误:`, error)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    console.log(`[EmailQueue] 消费者 ${consumerId} 已停止`)
  }

  // 处理单个邮件任务
  private async processEmailTask(task: EmailTask, applyInterval: boolean = true): Promise<void> {
    try {
      console.log(`[EmailQueue] 处理邮件任务: ${task.id} -> ${task.recipientEmail}`)
      
      // 检查活动状态
      const campaign = await prisma.campaign.findUnique({
        where: { id: task.campaignId },
        select: {
          id: true,
          status: true,
          enableRandomInterval: true,
          randomIntervalMin: true,
          randomIntervalMax: true
        }
      })
      
      if (!campaign) {
        console.log(`[EmailQueue] 活动 ${task.campaignId} 不存在，跳过任务 ${task.id}`)
        this.stats.failed++
        return
      }
      
      if (campaign.status === CampaignStatus.PAUSED) {
        console.log(`[EmailQueue] 活动 ${task.campaignId} 已暂停，跳过任务 ${task.id}`)
        // 将任务重新放回队列
        this.queue.unshift(task)
        this.stats.pending++
        return
      }
      
      if (campaign.status === CampaignStatus.STOPPED || campaign.status === CampaignStatus.FAILED) {
        console.log(`[EmailQueue] 活动 ${task.campaignId} 已停止，跳过任务 ${task.id}`)
        this.stats.failed++
        return
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

      // 记录开始发送日志
      await prisma.campaignLog.create({
        data: {
          campaignId: task.campaignId,
          level: 'info',
          message: `开始发送邮件: ${task.recipientEmail}`,
          details: {
            recipientEmail: task.recipientEmail,
            recipientName: task.recipientName || '',
            senderEmail: task.emailProfile.email,
            subject: task.subject
          }
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
      
      const info = await transporter.sendMail({
        from: fromAddress,
        to: task.recipientEmail,
        subject: task.subject,
        html: trackedContent
      })

      // 使用批量操作优化数据库访问
      if (task.emailId) {
        // 检查是否已经存在相同的发送记录
        const existingEmails = await batchDB.checkExistingSentEmails([task.emailId])
        
        if (!existingEmails.has(task.emailId)) {
          // 获取活动信息（可以考虑缓存优化）
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
              status: 'sent',
              sentAt: new Date(),
              messageId: info?.messageId || null
            })
            
            // 添加到批量活动统计更新队列
            batchDB.addCampaignStatsUpdate({
              campaignId: task.campaignId,
              sentCount: 1,
              lastSentAt: new Date()
            })
          }
        } else {
          console.log(`[EmailQueue] 邮件 ${task.emailId} 已存在发送记录，跳过计数更新以避免重复`)
          // 仍然更新最后发送时间
          batchDB.addCampaignStatsUpdate({
            campaignId: task.campaignId,
            lastSentAt: new Date()
          })
        }
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
      console.log(`[EmailQueue] 邮件发送成功: ${task.recipientEmail}`)
      
      // 检查活动是否完成
      await this.checkCampaignCompletion(task.campaignId)
      
    } catch (error: any) {
      console.error(`[EmailQueue] 邮件发送失败: ${task.recipientEmail}`, error)
      
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
      console.log(`[EmailQueue] 邮件发送失败，采用跳过策略: ${task.recipientEmail}`)
      
      // 直接标记为失败，不重试
      {
        // 使用批量操作检查失败记录
        const existingFailedEmails = await batchDB.checkExistingFailedEmails(task.campaignId, [task.recipientEmail])
        
        if (!existingFailedEmails.has(task.recipientEmail)) {
          // 添加到批量失败统计更新队列
          batchDB.addCampaignStatsUpdate({
            campaignId: task.campaignId,
            failedCount: 1
          })
          
          // 创建失败记录
          if (task.emailId) {
            const campaignInfoMap = await batchDB.getCampaignInfoBatch([task.campaignId])
            const campaignInfo = campaignInfoMap.get(task.campaignId)
            
            if (campaignInfo) {
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
        } else {
          console.log(`[EmailQueue] 邮件 ${task.recipientEmail} 已存在失败记录，跳过失败计数更新以避免重复`)
        }
        
        // 添加最终失败日志到批量队列
        batchDB.addCampaignLog({
          campaignId: task.campaignId,
          level: 'error',
          message: `💀 邮件发送最终失败: ${task.recipientEmail} (已达最大重试次数)`,
          details: {
            recipientEmail: task.recipientEmail,
            recipientName: task.recipientName || '',
            senderEmail: task.emailProfile.email,
            finalError: error.message || '未知错误',
            totalRetries: task.maxRetries,
            failedAt: new Date().toISOString()
          }
        })
        
        this.stats.failed++
        console.log(`[EmailQueue] 任务 ${task.id} 达到最大重试次数，标记为失败`)
      }
    } finally {
      // 从活动任务映射中移除
      const campaignTasks = this.campaignTasks.get(task.campaignId)
      if (campaignTasks) {
        campaignTasks.delete(task.id)
        if (campaignTasks.size === 0) {
          this.campaignTasks.delete(task.campaignId)
        }
      }
    }
  }

  // 检查活动是否完成
  private async checkCampaignCompletion(campaignId: string): Promise<void> {
    try {
      // 检查该活动是否还有待处理的任务
      const remainingTasks = this.getCampaignTaskCount(campaignId)
      const queueTasks = this.queue.filter(task => task.campaignId === campaignId).length
      
      if (remainingTasks === 0 && queueTasks === 0) {
        console.log(`[EmailQueue] 检测到活动 ${campaignId} 已完成，自动停止队列并更新状态`)
        
        // 更新活动状态为COMPLETED
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: CampaignStatus.COMPLETED,
            completedAt: new Date()
          }
        })
        
        // 清理该活动的任务
        this.campaignTasks.delete(campaignId)
        this.campaignLastSendTime.delete(campaignId)
        this.campaignSendingLocks.delete(campaignId)
        
        // 记录完成日志
        await prisma.campaignLog.create({
          data: {
            campaignId: campaignId,
            level: 'info',
            message: '活动已自动完成并停止队列',
            details: {
              remainingTasks,
              queueTasks,
              completedAt: new Date().toISOString(),
              note: '队列已自动停止，活动状态已更新为COMPLETED'
            }
          }
        })
        
        console.log(`[EmailQueue] 活动 ${campaignId} 已自动完成并清理相关资源`)
      }
    } catch (error) {
      console.error(`[EmailQueue] 检查活动完成状态失败 ${campaignId}:`, error)
    }
  }
}

// 导出单例实例
export const emailQueueService = EmailQueueService.getInstance()