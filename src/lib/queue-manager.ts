import { IndependentEmailQueueManager } from './independent-email-queue'
import { prisma } from './prisma'
import { CampaignStatus, EmailStatus } from '@prisma/client'
import { batchDB } from './batch-db-operations'

// 队列管理器
export class QueueManager {
  private static instance: QueueManager
  private isInitialized = false
  private healthCheckInterval: NodeJS.Timeout | null = null
  private statsInterval: NodeJS.Timeout | null = null

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager()
    }
    return QueueManager.instance
  }

  // 初始化队列管理器
  async initialize(options: {
    concurrency?: number
    healthCheckInterval?: number
    statsInterval?: number
  } = {}): Promise<void> {
    if (this.isInitialized) {
      console.log('[QueueManager] 队列管理器已初始化')
      return
    }

    const {
      concurrency = 10, // 增加到10个并发任务
      healthCheckInterval = 30000, // 30秒
      statsInterval = 10000 // 10秒
    } = options

    console.log('[QueueManager] 初始化队列管理器...')

    try {
      // 恢复运行中的活动
      await this.recoverRunningCampaigns()

      // 启动健康检查
      this.startHealthCheck(healthCheckInterval)

      // 启动统计信息输出
      this.startStatsLogging(statsInterval)

      this.isInitialized = true
      console.log('[QueueManager] 队列管理器初始化完成')

    } catch (error) {
      console.error('[QueueManager] 初始化失败:', error)
      throw error
    }
  }

  // 关闭队列管理器
  async shutdown(): Promise<void> {
    console.log('[QueueManager] 关闭队列管理器...')

    // 停止健康检查
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    // 停止统计信息输出
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }

    // 停止所有独立队列
    await IndependentEmailQueueManager.getInstance().stopAllQueues()

    this.isInitialized = false
    console.log('[QueueManager] 队列管理器已关闭')
  }

  // 启动活动
  async startCampaign(campaignId: string): Promise<void> {
    try {
      console.log(`[QueueManager] 启动活动: ${campaignId}`)

      // 更新活动状态为运行中
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.SENDING,
          isPaused: false
        }
      })

      // 记录活动启动日志
      await prisma.campaignLog.create({
        data: {
          campaignId,
          level: 'info',
          message: '活动已启动',
          details: {
            startedAt: new Date().toISOString(),
            action: 'start_campaign',
            source: 'queue_manager'
          }
        }
      })

      // 启动独立队列处理活动
      await IndependentEmailQueueManager.getInstance().startCampaignQueue(campaignId)

      console.log(`[QueueManager] 活动 ${campaignId} 启动成功`)

    } catch (error) {
      console.error(`[QueueManager] 启动活动失败 ${campaignId}:`, error)
      
      // 更新活动状态为失败
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.FAILED,
          isPaused: false
        }
      }).catch(console.error)
      
      throw error
    }
  }

  // 暂停活动
  async pauseCampaign(campaignId: string): Promise<void> {
    try {
      console.log(`[QueueManager] 暂停活动: ${campaignId}`)

      // 更新活动状态为暂停
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.PAUSED,
          isPaused: true
        }
      })

      // 记录手动暂停日志
      await prisma.campaignLog.create({
        data: {
          campaignId,
          level: 'info',
          message: '活动已手动暂停',
          details: {
            pausedAt: new Date().toISOString(),
            action: 'pause_campaign',
            source: 'queue_manager'
          }
        }
      })

      // 暂停独立队列
      await IndependentEmailQueueManager.getInstance().pauseCampaignQueue(campaignId)

      console.log(`[QueueManager] 活动 ${campaignId} 暂停成功`)

    } catch (error) {
      console.error(`[QueueManager] 暂停活动失败 ${campaignId}:`, error)
      throw error
    }
  }

  // 生成失败邮箱报告
  private async generateFailedEmailReport(campaignId: string): Promise<void> {
    try {
      console.log(`[QueueManager] 开始生成活动 ${campaignId} 的失败邮箱报告`)

      // 获取所有失败的邮件记录
      const failedEmails = await prisma.sentEmail.findMany({
        where: {
          campaignId,
          status: {
            in: [EmailStatus.FAILED, EmailStatus.BOUNCED, EmailStatus.REJECTED, EmailStatus.INVALID]
          }
        },
        include: {
          recipient: true,
          emailProfile: true
        }
      })

      console.log(`[QueueManager] 找到 ${failedEmails.length} 条失败邮件记录`)

      // 按失败类型分组统计
      const failureStats = {
        failed: 0,
        bounced: 0,
        rejected: 0,
        invalid: 0,
        total: failedEmails.length
      }

      // 更新收件人状态和统计信息
      for (const email of failedEmails) {
        // 统计失败类型
        switch (email.status) {
          case EmailStatus.FAILED:
            failureStats.failed++
            break
          case EmailStatus.BOUNCED:
            failureStats.bounced++
            break
          case EmailStatus.REJECTED:
            failureStats.rejected++
            break
          case EmailStatus.INVALID:
            failureStats.invalid++
            break
        }

        // 更新收件人的失败信息
        if (email.recipient) {
          const updateData: any = {
            emailStatus: email.status,
            lastFailureReason: email.errorMessage || '未知错误',
            failureCount: {
              increment: 1
            },
            updatedAt: new Date()
          }

          // 如果是退回邮件，增加退回计数
          if (email.status === EmailStatus.BOUNCED) {
            updateData.bounceCount = {
              increment: 1
            }
          }

          // 如果是无效邮箱或多次失败，标记为黑名单
          if (email.status === EmailStatus.INVALID || 
              (email.recipient.failureCount && email.recipient.failureCount >= 3)) {
            updateData.isBlacklisted = true
          }

          await prisma.recipient.update({
            where: { id: email.recipient.id },
            data: updateData
          })
        }
      }

      // 记录失败邮箱报告日志
      await prisma.campaignLog.create({
        data: {
          campaignId,
          level: 'info',
          message: '失败邮箱报告已生成',
          details: {
            failureStats,
            reportGeneratedAt: new Date().toISOString(),
            failedEmailsProcessed: failedEmails.length
          }
        }
      })

      console.log(`[QueueManager] 活动 ${campaignId} 失败邮箱报告生成完成:`, failureStats)
    } catch (error) {
      console.error(`[QueueManager] 生成失败邮箱报告失败:`, error)
      
      // 记录错误日志
      await prisma.campaignLog.create({
        data: {
          campaignId,
          level: 'error',
          message: '生成失败邮箱报告时发生错误',
          details: {
            error: error instanceof Error ? error.message : '未知错误',
            timestamp: new Date().toISOString()
          }
        }
      })
    }
  }

  // 停止活动
  async stopCampaign(campaignId: string): Promise<void> {
    try {
      console.log(`[QueueManager] 停止活动: ${campaignId}`)

      // 更新活动状态为停止
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.STOPPED,
          isPaused: false
        }
      })

      // 记录停止活动日志
      await prisma.campaignLog.create({
        data: {
          campaignId,
          level: 'info',
          message: '活动已停止',
          details: {
            stoppedAt: new Date().toISOString(),
            action: 'stop_campaign',
            source: 'queue_manager'
          }
        }
      })

      // 停止独立队列
      await IndependentEmailQueueManager.getInstance().stopCampaignQueue(campaignId)

      console.log(`[QueueManager] 活动 ${campaignId} 停止成功`)

    } catch (error) {
      console.error(`[QueueManager] 停止活动失败 ${campaignId}:`, error)
      throw error
    }
  }

  // 恢复运行中的活动
  private async recoverRunningCampaigns(): Promise<void> {
    try {
      console.log('[QueueManager] 恢复运行中的活动...')

      // 查找所有运行中的活动
      const runningCampaigns = await prisma.campaign.findMany({
        where: {
          status: CampaignStatus.SENDING
        },
        include: {
          template: true,
          emailProfile: true,
          excelUpload: true,
          recipientList: {
            include: { recipients: true }
          }
        }
      })

      console.log(`[QueueManager] 发现 ${runningCampaigns.length} 个运行中的活动`)

      // 为每个运行中的活动恢复任务
      for (const campaign of runningCampaigns) {
        try {
          console.log(`[QueueManager] 恢复活动: ${campaign.id}`)
          await IndependentEmailQueueManager.getInstance().startCampaignQueue(campaign.id)
        } catch (error) {
          console.error(`[QueueManager] 恢复活动失败 ${campaign.id}:`, error)
          
          // 将失败的活动标记为失败状态
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              status: CampaignStatus.FAILED,
              isPaused: false
            }
          }).catch(console.error)
        }
      }

      console.log('[QueueManager] 活动恢复完成')

    } catch (error) {
      console.error('[QueueManager] 恢复运行中的活动失败:', error)
    }
  }

  // 启动健康检查
  private startHealthCheck(interval: number): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        console.log('[QueueManager] 执行健康检查...')
        
        // 检查队列状态
        const stats = IndependentEmailQueueManager.getInstance().getAllStats()
        console.log('[QueueManager] 队列统计:', stats)
        
        // 检查是否有长时间运行的活动需要干预
        await this.checkLongRunningCampaigns()
        
        // 移除自动暂停条件检查，只允许手动控制
        // await this.checkAutoPauseConditions() // 已禁用自动暂停
        
      } catch (error) {
        console.error('[QueueManager] 健康检查失败:', error)
      }
    }, interval)
  }

  // 启动统计信息输出
  private startStatsLogging(interval: number): void {
    this.statsInterval = setInterval(() => {
      const stats = IndependentEmailQueueManager.getInstance().getAllStats()
      console.log(`[QueueManager] 队列统计:`, stats)
    }, interval)
  }

  // 获取队列统计信息
  getQueueStats() {
    return IndependentEmailQueueManager.getInstance().getAllStats()
  }

  // 强制推进指定活动的队列
  async forceProgressCampaign(campaignId: string): Promise<void> {
    try {
      console.log(`[QueueManager] 强制推进活动队列: ${campaignId}`)
      
      // 调用独立队列管理器的强制推进方法
      await IndependentEmailQueueManager.getInstance().forceProgressCampaign(campaignId)
      
      // 记录强制推进日志
      await prisma.campaignLog.create({
        data: {
          campaignId,
          level: 'info',
          message: '手动强制推进队列',
          details: {
            triggeredAt: new Date().toISOString(),
            action: 'force_progress'
          }
        }
      })
      
      console.log(`[QueueManager] 活动 ${campaignId} 队列强制推进完成`)
      
    } catch (error) {
      console.error(`[QueueManager] 强制推进活动队列失败 ${campaignId}:`, error)
      
      // 记录错误日志
      await prisma.campaignLog.create({
        data: {
          campaignId,
          level: 'error',
          message: '强制推进队列失败',
          details: {
            error: error instanceof Error ? error.message : '未知错误',
            timestamp: new Date().toISOString()
          }
        }
      }).catch(console.error)
      
      throw error
    }
  }

  // 检查长时间运行的活动
  private async checkLongRunningCampaigns(): Promise<void> {
    try {
      // 检查是否有长时间运行的活动
      const longRunningCampaigns = await prisma.campaign.findMany({
        where: {
          status: CampaignStatus.SENDING,
          updatedAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时前
          }
        }
      })

      if (longRunningCampaigns.length > 0) {
        console.warn(`[QueueManager] 警告: 发现 ${longRunningCampaigns.length} 个长时间运行的活动`)
        
        for (const campaign of longRunningCampaigns) {
          // 记录警告日志
          await prisma.campaignLog.create({
            data: {
              campaignId: campaign.id,
              level: 'warning',
              message: '活动运行时间过长，可能需要检查',
              details: {
                runningTime: '超过24小时',
                lastUpdate: campaign.updatedAt
              }
            }
          })
        }
      }
    } catch (error) {
      console.error('[QueueManager] 检查长时间运行活动失败:', error)
    }
  }

  // 检查自动暂停条件
  private async checkAutoPauseConditions(): Promise<void> {
    try {
      // 查找所有运行中的活动
      const runningCampaigns = await prisma.campaign.findMany({
        where: {
          status: CampaignStatus.SENDING
        },
        select: {
          id: true,
          name: true,
          sentCount: true,
          failedCount: true,
          totalRecipients: true,
          lastSentAt: true,
          lastProcessedIndex: true
        }
      })

      for (const campaign of runningCampaigns) {
        let shouldComplete = false
        let completeReason = ''

        // 在判断完成前，强制刷新批量操作，确保 sent/failed 统计最新
        try {
          await batchDB.forceFlush()
        } catch (e) {
          console.warn('[QueueManager] 执行 batchDB.forceFlush 时出现警告:', e)
        }

        // 重新从数据库获取最新统计，避免使用可能过期的计数
        const fresh = await prisma.campaign.findUnique({
          where: { id: campaign.id },
          select: {
            id: true,
            sentCount: true,
            failedCount: true,
            totalRecipients: true,
            lastSentAt: true,
            name: true
          }
        })
        const sentCount = fresh?.sentCount || 0
        const failedCount = fresh?.failedCount || 0
        const totalRecipients = fresh?.totalRecipients || 0

        // 检查是否所有邮件都已处理完毕（发送成功或失败）
        const totalProcessed = sentCount + failedCount
        const isAllProcessed = totalProcessed >= totalRecipients
        
        if (isAllProcessed) {
          shouldComplete = true
          completeReason = '所有邮件已处理完毕'
        }

        // 检查长时间无活动 - 但要考虑发送间隔设置
        if (fresh?.lastSentAt && !isAllProcessed) {
          const timeSinceLastSent = Date.now() - new Date(fresh.lastSentAt).getTime()
          
          // 获取活动的发送间隔设置（从EmailProfile获取）
          const campaignSettings = await prisma.campaign.findUnique({
            where: { id: campaign.id },
            select: { 
              emailProfile: {
                select: {
                  sendInterval: true,
                  randomInterval: true
                }
              }
            }
          })
          
          // 计算动态阈值：发送间隔的10倍，最少30分钟，最多2小时
          const baseInterval = (campaignSettings?.emailProfile?.sendInterval || 60) * 1000 // 转换为毫秒
          const randomInterval = (campaignSettings?.emailProfile?.randomInterval || 0) * 1000
          const maxInterval = baseInterval + randomInterval
          const dynamicThreshold = Math.max(
            30 * 60 * 1000, // 最少30分钟
            Math.min(
              2 * 60 * 60 * 1000, // 最多2小时
              maxInterval * 10 // 发送间隔的10倍
            )
          )
          
          if (timeSinceLastSent > dynamicThreshold) {
            console.warn(`[QueueManager] 活动 ${campaign.id} 长时间无活动，尝试刷新发送任务（阈值: ${Math.round(dynamicThreshold/1000/60)}分钟）`)
            
            try {
              // 自动刷新发送任务以保持持续发送
              const refreshResult = await IndependentEmailQueueManager.getInstance().refreshCampaignQueue(campaign.id)
              
              if (refreshResult.success) {
                // 记录刷新成功日志
                await prisma.campaignLog.create({
                  data: {
                    campaignId: campaign.id,
                    level: 'info',
                    message: `检测到队列可能阻塞，已自动刷新发送任务（动态阈值: ${Math.round(dynamicThreshold/1000/60)}分钟）`,
                    details: {
                      totalProcessed,
                      totalRecipients: totalRecipients,
                      lastSentAt: fresh.lastSentAt,
                      refreshedAt: new Date().toISOString(),
                      timeSinceLastSentMin: Math.round(timeSinceLastSent/1000/60),
                      sendInterval: campaignSettings?.emailProfile?.sendInterval,
                      randomInterval: campaignSettings?.emailProfile?.randomInterval,
                      dynamicThresholdMin: Math.round(dynamicThreshold/1000/60)
                    }
                  }
                })
                
                console.log(`[QueueManager] 活动 ${campaign.id} 发送任务已刷新`)
                // 刷新成功后跳过完成检查，给队列时间继续处理
                continue
              } else {
                // 刷新失败，记录警告但不跳过完成检查
                console.error(`[QueueManager] 刷新活动 ${campaign.id} 发送任务失败: ${refreshResult.error}`)
                
                await prisma.campaignLog.create({
                  data: {
                    campaignId: campaign.id,
                    level: 'warning',
                    message: '活动长时间无发送活动，队列刷新失败',
                    details: {
                      totalProcessed,
                      totalRecipients: totalRecipients,
                      lastSentAt: fresh.lastSentAt,
                      refreshError: refreshResult.error,
                      dynamicThresholdMin: Math.round(dynamicThreshold/1000/60)
                    }
                  }
                })
              }
            } catch (refreshError) {
              console.error(`[QueueManager] 刷新活动 ${campaign.id} 发送任务异常:`, refreshError)
              
              // 记录刷新异常的警告
              await prisma.campaignLog.create({
                data: {
                  campaignId: campaign.id,
                  level: 'warning',
                  message: '活动长时间无发送活动，队列刷新异常',
                  details: {
                    totalProcessed,
                    totalRecipients: totalRecipients,
                    lastSentAt: fresh.lastSentAt,
                    refreshError: refreshError instanceof Error ? refreshError.message : String(refreshError),
                    dynamicThresholdMin: Math.round(dynamicThreshold/1000/60)
                  }
                }
              })
            }
          }
        }

        if (shouldComplete) {
          console.log(`[QueueManager] 检测到活动 ${campaign.id} 可能已完成: ${completeReason}，自动停止队列并更新状态`)
          
          // 二次校验：检查队列状态
          const allStats = IndependentEmailQueueManager.getInstance().getAllStats()
          const campaignStats = allStats[campaign.id]
          const processingCount = campaignStats?.processing || 0
          const queueLength = campaignStats?.queueLength || 0
          
          // 如果队列确实为空且没有处理中的任务，则自动完成活动
          if (processingCount === 0 && queueLength === 0) {
            // 更新活动状态为COMPLETED
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: {
                status: CampaignStatus.COMPLETED,
                completedAt: new Date()
              }
            })
            
            // 停止队列
            await IndependentEmailQueueManager.getInstance().stopCampaignQueue(campaign.id)
            
            // 记录完成日志
            await prisma.campaignLog.create({
              data: {
                campaignId: campaign.id,
                level: 'info',
                message: `活动已自动完成并停止队列`,
                details: {
                  reason: completeReason,
                  sentCount,
                  failedCount,
                  totalRecipients,
                  successRate: totalRecipients > 0 ? ((sentCount) / totalRecipients * 100).toFixed(1) + '%' : '0%',
                  processingCount,
                  queueLength,
                  completedAt: new Date().toISOString(),
                  note: '队列已自动停止，活动状态已更新为COMPLETED'
                }
              }
            })
            
            console.log(`[QueueManager] 活动 ${campaign.id} 已自动完成并停止队列`)
          } else {
            // 如果还有处理中的任务，只记录日志
            await prisma.campaignLog.create({
              data: {
                campaignId: campaign.id,
                level: 'info',
                message: `检测到活动可能已完成，但仍有任务处理中`,
                details: {
                  reason: completeReason,
                  sentCount,
                  failedCount,
                  totalRecipients,
                  successRate: totalRecipients > 0 ? ((sentCount) / totalRecipients * 100).toFixed(1) + '%' : '0%',
                  processingCount,
                  queueLength,
                  detectedAt: new Date().toISOString(),
                  note: '等待处理中任务完成后自动停止'
                }
              }
            })
          }
        }
      }
    } catch (error) {
      console.error('[QueueManager] 检查自动暂停条件失败:', error)
    }
  }

  // 检查是否已初始化
  isReady(): boolean {
    return this.isInitialized
  }
}

// 导出单例实例
export const queueManager = QueueManager.getInstance()