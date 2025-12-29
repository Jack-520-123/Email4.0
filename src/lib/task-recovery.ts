import { CampaignStatus } from '@prisma/client'
import { prisma } from './prisma'
import { queueManager } from './queue-manager'
import { IndependentEmailQueueManager } from './independent-email-queue'

// 全局任务管理（保持向后兼容）
interface RunningTask {
  campaignId: string
  status: 'running' | 'paused' | 'stopped'
  lastProcessedIndex: number
  startTime: Date
}

// 声明全局变量（保持向后兼容）
declare global {
  var runningTasks: Map<string, RunningTask>
}

// 队列系统已替代全局任务管理

// 任务恢复服务
export class TaskRecoveryService {
  private static instance: TaskRecoveryService
  private isInitialized = false
  private healthCheckInterval: NodeJS.Timeout | null = null
  private isRecursiveRunning = false

  static getInstance(): TaskRecoveryService {
    if (!TaskRecoveryService.instance) {
      TaskRecoveryService.instance = new TaskRecoveryService()
    }
    return TaskRecoveryService.instance
  }

  // 初始化任务恢复服务
  async initialize() {
    if (this.isInitialized) {
      console.log('[TaskRecovery] 服务已初始化')
      return
    }

    // 注意：不再使用 global.runningTasks，任务状态由独立队列系统管理

    console.log('[TaskRecovery] 初始化任务恢复服务...')
    
    try {
      // 初始化队列管理器
      await queueManager.initialize()
      
      this.isInitialized = true
      
      // 启动健康检查（递归模式）
      this.startHealthCheck()
      
      console.log('[TaskRecovery] 任务恢复服务初始化完成（递归模式）')
    } catch (error) {
      console.error('[TaskRecovery] 初始化失败:', error)
      this.isInitialized = false
      throw error
    }
  }

  // 停止任务恢复服务
  async shutdown() {
    console.log('[TaskRecovery] 正在停止任务恢复服务...')
    
    this.isInitialized = false
    this.stopHealthCheck()
    
    console.log('[TaskRecovery] 任务恢复服务已停止')
  }

  // 启动健康检查（递归调用版本）
  private startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    if (this.isRecursiveRunning) {
      console.log('[TaskRecovery] 递归健康检查已在运行中')
      return
    }

    this.isRecursiveRunning = true
    console.log('[TaskRecovery] 健康检查已启动（递归模式）')
    
    // 立即执行第一次检查，然后开始递归
    this.recursiveHealthCheck()
  }

  // 停止健康检查
  private stopHealthCheck() {
    this.isRecursiveRunning = false
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    console.log('[TaskRecovery] 健康检查已停止')
  }

  // 递归健康检查
  private async recursiveHealthCheck() {
    // 检查是否应该继续运行
    if (!this.isInitialized || !this.isRecursiveRunning) {
      console.log('[TaskRecovery] 递归健康检查已停止')
      return
    }

    try {
      console.log('[TaskRecovery] 执行递归健康检查...')
      await this.performHealthCheck()
    } catch (error) {
      console.error('[TaskRecovery] 递归健康检查失败:', error)
    }

    // 递归调用：2分钟后再次执行（优化：从5分钟缩短到2分钟）
    setTimeout(() => {
      this.recursiveHealthCheck()
    }, 2 * 60 * 1000) // 2分钟后递归调用
  }

  // 执行健康检查
  async performHealthCheck() {
    console.log('[TaskRecovery] 执行健康检查...')
    
    try {
      // 清理僵尸任务
      await this.cleanupZombieTasks()
      
      // 检查超时任务
      await this.checkTimeoutTasks()
      
      // 检查待发送任务
      await this.checkPendingTasks()
      
      console.log('[TaskRecovery] 健康检查完成')
    } catch (error) {
      console.error('[TaskRecovery] 健康检查执行失败:', error)
    }
  }

  // 清理僵尸任务
  private async cleanupZombieTasks() {
    const zombieThreshold = new Date(Date.now() - 60 * 60 * 1000) // 1小时前（增加到1小时）
    
    const zombieTasks = await prisma.campaign.findMany({
      where: {
        status: CampaignStatus.SENDING,
        lastSentAt: {
          lt: zombieThreshold
        }
      }
    })

    for (const task of zombieTasks) {
      console.log(`[TaskRecovery] 发现可能的僵尸任务: ${task.id}`)
      
      // 检查任务是否真的在运行（通过独立队列系统）
      const queueManager = IndependentEmailQueueManager.getInstance()
      const queue = queueManager.getCampaignQueue(task.id)
      if (!queue || !queue.isRunning()) {
        console.log(`[TaskRecovery] 恢复僵尸任务: ${task.id}`)
        await this.recoverCampaignTask(task)
      } else {
        // 队列在运行，检查是否有活跃任务
        const queueStats = queue.getStats()
        const hasActiveTasks = queueStats.pending > 0 || queueStats.processing > 0
        
        if (hasActiveTasks) {
          console.log(`[TaskRecovery] 任务 ${task.id} 队列正常运行中，跳过恢复`)
        } else {
          console.log(`[TaskRecovery] 任务 ${task.id} 队列空闲但长时间无活动，尝试恢复`)
          await this.recoverCampaignTask(task)
        }
      }
    }
  }

  // 检查超时任务（优化：与独立队列系统协调工作）
  private async checkTimeoutTasks() {
    // 使用更长的超时阈值，避免与独立队列的2分钟健康检查冲突
    const timeoutThreshold = new Date(Date.now() - 30 * 60 * 1000) // 30分钟前（保持原有的快速响应）
    
    const timeoutTasks = await prisma.campaign.findMany({
      where: {
        status: CampaignStatus.SENDING,
        lastSentAt: {
          lt: timeoutThreshold
        }
      }
    })

    for (const task of timeoutTasks) {
      const queueManager = IndependentEmailQueueManager.getInstance()
      const queue = queueManager.getCampaignQueue(task.id)
      
      // 如果队列存在且正在运行，检查是否需要协助
      if (queue && queue.isRunning()) {
        // 检查队列状态
        const queueStats = queue.getStats()
        const hasActiveTasks = queueStats.pending > 0 || queueStats.processing > 0
        
        // 如果队列有活跃任务，说明独立队列系统正在正常工作
        if (hasActiveTasks) {
          console.log(`[TaskRecovery] 队列 ${task.id} 有活跃任务（待处理:${queueStats.pending}, 处理中:${queueStats.processing}），独立队列系统正常工作`)
          continue
        }
        
        // 检查是否是真正的长时间卡死（超过独立队列的最大重启阈值）
        const criticalTimeout = new Date(Date.now() - 45 * 60 * 1000) // 45分钟前（给独立队列充分的自我修复时间）
        if (task.lastSentAt && task.lastSentAt > criticalTimeout) {
          console.log(`[TaskRecovery] 队列 ${task.id} 最近有活动（${Math.round((Date.now() - task.lastSentAt.getTime()) / 60000)}分钟前），让独立队列系统继续处理`)
          continue
        }
        
        // 只有在队列长时间完全卡死时才介入（作为最后的保障）
        console.warn(`[TaskRecovery] 队列 ${task.id} 长时间无活动（${Math.round((Date.now() - (task.lastSentAt?.getTime() || 0)) / 60000)}分钟），作为最后保障进行重启`)
        await queueManager.stopCampaignQueue(task.id)
        await this.recoverCampaignTask(task)
      } else if (!queue) {
        // 如果队列不存在，说明需要恢复
        console.log(`[TaskRecovery] 队列 ${task.id} 不存在，尝试恢复`)
        await this.recoverCampaignTask(task)
      }
    }
  }

  // 检查待发送任务
  private async checkPendingTasks() {
    const now = new Date()
    
    const pendingTasks = await prisma.campaign.findMany({
      where: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: {
          lte: now
        }
      }
    })

    for (const task of pendingTasks) {
      const queueManager = IndependentEmailQueueManager.getInstance()
      const queue = queueManager.getCampaignQueue(task.id)
      if (!queue || !queue.isRunning()) {
        console.log(`[TaskRecovery] 启动待发送任务: ${task.id}`)
        await this.recoverCampaignTask(task)
      }
    }
  }

  // 恢复所有需要恢复的任务
  async recoverCampaignTasks() {
    console.log('[TaskRecovery] 开始恢复活动任务...')
    
    try {
      const now = new Date()
      
      // 查找需要恢复的活动
      const campaignsToRecover = await prisma.campaign.findMany({
        where: {
          OR: [
            {
              status: CampaignStatus.SCHEDULED,
              scheduledAt: { lte: now }
            },
            {
              status: CampaignStatus.SENDING
            },
            {
              status: CampaignStatus.PAUSED
            }
          ]
        },
        include: {
          template: true,
          emailProfile: true,
          excelUpload: true,
          recipientList: {
            include: { recipients: true }
          },
          user: true
        }
      })

      console.log(`[TaskRecovery] 找到 ${campaignsToRecover.length} 个需要恢复的活动`)

      for (const campaign of campaignsToRecover) {
        // 检查任务是否已经在运行（通过独立队列系统）
        const queueManager = IndependentEmailQueueManager.getInstance()
        const queue = queueManager.getCampaignQueue(campaign.id)
        if (queue && queue.isRunning()) {
          console.log(`[TaskRecovery] 活动 ${campaign.id} 已在运行中，跳过`)
          continue
        }

        await this.recoverCampaignTask(campaign)
      }
      
      console.log('[TaskRecovery] 任务恢复完成')
    } catch (error) {
      console.error('[TaskRecovery] 任务恢复失败:', error)
      throw error
    }
  }

  // 恢复单个活动任务
  private async recoverCampaignTask(campaign: any) {
    try {
      console.log(`[TaskRecovery] 恢复活动任务: ${campaign.id}`)
      
      // 注意：任务状态现在由独立队列系统管理，不再使用 runningTasks

      // 更新活动状态为发送中
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { 
          status: CampaignStatus.SENDING,
          isPaused: false
        }
      })

      // 开始邮件发送
      await this.processEmailSending(campaign)
      
    } catch (error) {
      console.error(`[TaskRecovery] 恢复活动任务失败 ${campaign.id}:`, error)
      
      // 清理队列状态
      const queueManager = IndependentEmailQueueManager.getInstance()
      await queueManager.stopCampaignQueue(campaign.id)
      
      // 更新任务状态为失败
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { 
          status: CampaignStatus.FAILED,
          isPaused: false
        }
      })
      
      throw error
    }
  }

  // 处理邮件发送（重构为使用队列管理器）
  private async processEmailSending(campaign: any) {
    const campaignId = campaign.id
    
    try {
      console.log(`[TaskRecovery] 开始处理邮件发送: ${campaignId}（使用队列模式）`)
      
      // 使用独立队列管理器启动活动队列
      await IndependentEmailQueueManager.getInstance().startCampaignQueue(campaignId)
      
      console.log(`[TaskRecovery] 活动 ${campaignId} 任务已添加到队列`)
      
    } catch (error) {
      console.error(`[TaskRecovery] 发送任务 ${campaignId} 执行失败:`, error)
      
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { 
          status: CampaignStatus.FAILED,
          isPaused: false
        }
      })
      
      // 清理队列状态
      const queueManager = IndependentEmailQueueManager.getInstance()
      await queueManager.stopCampaignQueue(campaignId)
      
      throw error
    }
  }

  // 启动活动（新增方法，使用队列管理器）
  async startCampaign(campaignId: string): Promise<void> {
    try {
      console.log(`[TaskRecovery] 启动活动: ${campaignId}`)
      
      // 确保队列管理器已初始化并运行
      if (!queueManager.isReady()) {
        console.log(`[TaskRecovery] 队列管理器未初始化，正在自动启动...`)
        await queueManager.initialize()
        console.log(`[TaskRecovery] 队列管理器自动启动完成`)
      }
      
      // 独立队列系统会自动管理队列的启动和停止
      
      // 使用队列管理器启动活动
      await queueManager.startCampaign(campaignId)
      
      console.log(`[TaskRecovery] 活动 ${campaignId} 启动成功`)
    } catch (error) {
      console.error(`[TaskRecovery] 启动活动失败 ${campaignId}:`, error)
      
      // 错误处理由队列系统管理
      
      throw error
    }
  }

  // 暂停活动（新增方法，使用队列管理器）
  async pauseCampaign(campaignId: string): Promise<void> {
    try {
      console.log(`[TaskRecovery] 暂停活动: ${campaignId}`)
      
      // 使用队列管理器暂停活动
      await queueManager.pauseCampaign(campaignId)
      
      // 任务状态由队列系统管理
      
      console.log(`[TaskRecovery] 活动 ${campaignId} 暂停成功`)
    } catch (error) {
      console.error(`[TaskRecovery] 暂停活动失败 ${campaignId}:`, error)
      throw error
    }
  }

  // 停止活动（新增方法，使用队列管理器）
  async stopCampaign(campaignId: string): Promise<void> {
    try {
      console.log(`[TaskRecovery] 停止活动: ${campaignId}`)
      
      // 使用队列管理器停止活动
      await queueManager.stopCampaign(campaignId)
      
      // 任务清理由队列系统管理
      
      console.log(`[TaskRecovery] 活动 ${campaignId} 停止成功`)
    } catch (error) {
      console.error(`[TaskRecovery] 停止活动失败 ${campaignId}:`, error)
      throw error
    }
  }

  // 获取队列统计信息（新增方法）
  getQueueStats() {
    return queueManager.getQueueStats()
  }

  // 获取活动的任务数量
  getCampaignTaskCount(campaignId: string): number {
    const queueManager = IndependentEmailQueueManager.getInstance()
    // 检查队列是否正在运行，而不是仅仅检查队列长度
    // 这样可以正确反映活动的运行状态
    return queueManager.isQueueRunning(campaignId) ? 1 : 0
  }

  // 恢复特定任务
  async recoverSpecificTask(campaignId: string) {
    try {
      console.log(`[TaskRecovery] 开始恢复任务: ${campaignId}`)
      
      // 查找活动
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          template: true,
          emailProfile: true,
          excelUpload: true,
          recipientList: {
            include: { recipients: true }
          },
          user: true
        }
      })

      if (!campaign) {
        return { success: false, message: '活动不存在' }
      }

      if (!['SENDING', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
        return { success: false, message: '活动状态不支持恢复' }
      }

      // 检查是否已经在运行（通过独立队列系统）
      const queueManager = IndependentEmailQueueManager.getInstance()
      const queue = queueManager.getCampaignQueue(campaignId)
      if (queue && queue.isRunning()) {
        return { success: false, message: '任务已在运行中' }
      }

      // 恢复任务
      await this.recoverCampaignTask(campaign)
      
      return { success: true, message: '任务恢复成功' }
    } catch (error) {
      console.error(`[TaskRecovery] 恢复任务失败 ${campaignId}:`, error)
      return { success: false, message: error instanceof Error ? error.message : '恢复失败' }
    }
  }
}

// 导出单例实例
export const taskRecoveryService = TaskRecoveryService.getInstance()