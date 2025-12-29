import { prisma } from './prisma'
import { queryOptimization } from './query-optimization'
import { batchDB } from './batch-db-operations'

/**
 * 性能监控工具
 * 监控数据库连接、查询性能、邮件队列状态等关键指标
 */

export interface PerformanceMetrics {
  timestamp: number
  database: {
    connections: {
      total: number
      active: number
      idle: number
    }
    queryStats: {
      averageQueryTime: number
      slowQueries: number
      totalQueries: number
    }
    connectionPool: {
      size: number
      available: number
      pending: number
    }
  }
  emailQueue: {
    batchOperations: {
      pendingSentEmails: number
      pendingCampaignLogs: number
      pendingStatsUpdates: number
      lastFlushTime: number
      batchSize: number
      batchTimeout: number
      isTimerActive: boolean
    }
    queueStatus: {
      activeQueues: number
      totalEmailsSent: number
      totalEmailsFailed: number
      averageSendTime: number
    }
  }
  cache: {
    queryCache: {
      size: number
      hitRate: number
      missRate: number
    }
  }
  system: {
    memoryUsage: {
      used: number
      total: number
      percentage: number
    }
    uptime: number
  }
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetrics[] = []
  private readonly MAX_METRICS_HISTORY = 100
  private monitoringInterval: NodeJS.Timeout | null = null
  private isMonitoring = false
  private queryStartTimes = new Map<string, number>()
  private queryStats = {
    totalQueries: 0,
    totalQueryTime: 0,
    slowQueries: 0
  }
  private cacheStats = {
    hits: 0,
    misses: 0
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  // 开始性能监控
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      console.log('[PerformanceMonitor] 监控已在运行中')
      return
    }

    // 在Serverless环境中，不启动定时监控，只提供按需收集
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
      console.log('[PerformanceMonitor] Serverless环境，使用按需监控模式')
      this.isMonitoring = true
      return
    }

    console.log(`[PerformanceMonitor] 开始性能监控，间隔: ${intervalMs}ms`)
    this.isMonitoring = true

    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics()
        this.addMetrics(metrics)
      } catch (error) {
        console.error('[PerformanceMonitor] 收集性能指标失败:', error)
      }
    }, intervalMs)
  }

  // 停止性能监控
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    console.log('[PerformanceMonitor] 停止性能监控')
    this.isMonitoring = false

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  // 收集性能指标
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const timestamp = Date.now()

    // 收集数据库连接信息
    const dbConnections = await this.getDatabaseConnections()
    
    // 收集批量操作状态
    const batchStats = batchDB.getStats()
    
    // 收集缓存统计
    const cacheStats = this.getCacheStats()
    
    // 收集系统信息
    const systemStats = this.getSystemStats()
    
    // 收集邮件队列状态
    const queueStats = await this.getEmailQueueStats()

    return {
      timestamp,
      database: {
        connections: dbConnections,
        queryStats: {
          averageQueryTime: this.queryStats.totalQueries > 0 
            ? this.queryStats.totalQueryTime / this.queryStats.totalQueries 
            : 0,
          slowQueries: this.queryStats.slowQueries,
          totalQueries: this.queryStats.totalQueries
        },
        connectionPool: {
          size: 20, // 从配置中获取
          available: Math.max(0, 20 - dbConnections.active),
          pending: 0 // 需要从连接池获取
        }
      },
      emailQueue: {
        batchOperations: {
          pendingSentEmails: batchStats.currentBatches.sentEmailCount,
          pendingCampaignLogs: batchStats.currentBatches.campaignLogCount,
          pendingStatsUpdates: batchStats.currentBatches.campaignStatsCount,
          lastFlushTime: Date.now(), // 当前时间戳作为最后刷新时间
          batchSize: batchStats.batchSize,
          batchTimeout: batchStats.batchTimeout,
          isTimerActive: batchStats.isTimerActive
        },
        queueStatus: queueStats
      },
      cache: {
        queryCache: cacheStats
      },
      system: systemStats
    }
  }

  // 获取数据库连接信息
  private async getDatabaseConnections(): Promise<{ total: number; active: number; idle: number }> {
    try {
      const result = await queryOptimization.getDatabaseConnectionStatus()
      if (result && result.length > 0) {
        const stats = result[0]
        return {
          total: parseInt(stats.total_connections) || 0,
          active: parseInt(stats.active_connections) || 0,
          idle: parseInt(stats.idle_connections) || 0
        }
      }
    } catch (error) {
      console.error('[PerformanceMonitor] 获取数据库连接信息失败:', error)
    }
    
    return { total: 0, active: 0, idle: 0 }
  }

  // 获取邮件队列统计
  private async getEmailQueueStats(): Promise<{
    activeQueues: number
    totalEmailsSent: number
    totalEmailsFailed: number
    averageSendTime: number
  }> {
    try {
      // 获取今日发送统计
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const [sentStats, failedStats] = await Promise.all([
        prisma.sentEmail.count({
          where: {
            status: 'sent',
            sentAt: {
              gte: today
            }
          }
        }),
        prisma.sentEmail.count({
          where: {
            status: 'failed',
            sentAt: {
              gte: today
            }
          }
        })
      ])

      // 获取活跃队列数量（正在运行的活动）
      const activeQueues = await prisma.campaign.count({
        where: {
          status: 'SENDING'
        }
      })

      return {
        activeQueues,
        totalEmailsSent: sentStats,
        totalEmailsFailed: failedStats,
        averageSendTime: 0 // 需要从日志中计算
      }
    } catch (error) {
      console.error('[PerformanceMonitor] 获取邮件队列统计失败:', error)
      return {
        activeQueues: 0,
        totalEmailsSent: 0,
        totalEmailsFailed: 0,
        averageSendTime: 0
      }
    }
  }

  // 获取缓存统计
  private getCacheStats(): { size: number; hitRate: number; missRate: number } {
    const total = this.cacheStats.hits + this.cacheStats.misses
    return {
      size: 0, // 需要从 queryOptimization 获取
      hitRate: total > 0 ? (this.cacheStats.hits / total) * 100 : 0,
      missRate: total > 0 ? (this.cacheStats.misses / total) * 100 : 0
    }
  }

  // 获取系统统计
  private getSystemStats(): {
    memoryUsage: { used: number; total: number; percentage: number }
    uptime: number
  } {
    const memUsage = process.memoryUsage()
    const totalMemory = memUsage.heapTotal
    const usedMemory = memUsage.heapUsed
    
    return {
      memoryUsage: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      uptime: process.uptime()
    }
  }

  // 添加性能指标
  private addMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics)
    
    // 保持历史记录在限制范围内
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY)
    }
  }

  // 获取最新的性能指标
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }

  // 获取性能指标历史
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit) {
      return this.metrics.slice(-limit)
    }
    return [...this.metrics]
  }

  // 获取性能摘要
  getPerformanceSummary(): {
    database: {
      averageConnections: number
      peakConnections: number
      averageQueryTime: number
    }
    emailQueue: {
      totalEmailsSent: number
      totalEmailsFailed: number
      averageQueueSize: number
    }
    system: {
      averageMemoryUsage: number
      peakMemoryUsage: number
    }
  } {
    if (this.metrics.length === 0) {
      return {
        database: { averageConnections: 0, peakConnections: 0, averageQueryTime: 0 },
        emailQueue: { totalEmailsSent: 0, totalEmailsFailed: 0, averageQueueSize: 0 },
        system: { averageMemoryUsage: 0, peakMemoryUsage: 0 }
      }
    }

    const dbConnections = this.metrics.map(m => m.database.connections.total)
    const queryTimes = this.metrics.map(m => m.database.queryStats.averageQueryTime)
    const memoryUsages = this.metrics.map(m => m.system.memoryUsage.percentage)
    const emailsSent = this.metrics.map(m => m.emailQueue.queueStatus.totalEmailsSent)
    const emailsFailed = this.metrics.map(m => m.emailQueue.queueStatus.totalEmailsFailed)
    const queueSizes = this.metrics.map(m => 
      m.emailQueue.batchOperations.pendingSentEmails + 
      m.emailQueue.batchOperations.pendingCampaignLogs + 
      m.emailQueue.batchOperations.pendingStatsUpdates
    )

    return {
      database: {
        averageConnections: dbConnections.reduce((a, b) => a + b, 0) / dbConnections.length,
        peakConnections: Math.max(...dbConnections),
        averageQueryTime: queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length
      },
      emailQueue: {
        totalEmailsSent: Math.max(...emailsSent),
        totalEmailsFailed: Math.max(...emailsFailed),
        averageQueueSize: queueSizes.reduce((a, b) => a + b, 0) / queueSizes.length
      },
      system: {
        averageMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        peakMemoryUsage: Math.max(...memoryUsages)
      }
    }
  }

  // 记录查询开始时间
  recordQueryStart(queryId: string): void {
    this.queryStartTimes.set(queryId, Date.now())
  }

  // 记录查询结束时间
  recordQueryEnd(queryId: string): void {
    const startTime = this.queryStartTimes.get(queryId)
    if (startTime) {
      const duration = Date.now() - startTime
      this.queryStats.totalQueries++
      this.queryStats.totalQueryTime += duration
      
      // 记录慢查询（超过1秒）
      if (duration > 1000) {
        this.queryStats.slowQueries++
        console.warn(`[PerformanceMonitor] 慢查询检测: ${queryId}, 耗时: ${duration}ms`)
      }
      
      this.queryStartTimes.delete(queryId)
    }
  }

  // 记录缓存命中
  recordCacheHit(): void {
    this.cacheStats.hits++
  }

  // 记录缓存未命中
  recordCacheMiss(): void {
    this.cacheStats.misses++
  }

  // 检查性能警告
  checkPerformanceAlerts(): {
    alerts: Array<{
      type: 'warning' | 'error'
      message: string
      metric: string
      value: number
      threshold: number
    }>
  } {
    const alerts: Array<{
      type: 'warning' | 'error'
      message: string
      metric: string
      value: number
      threshold: number
    }> = []

    const latest = this.getLatestMetrics()
    if (!latest) {
      return { alerts }
    }

    // 检查数据库连接数
    if (latest.database.connections.active > 15) {
      alerts.push({
        type: 'warning',
        message: '数据库活跃连接数过高',
        metric: 'database.connections.active',
        value: latest.database.connections.active,
        threshold: 15
      })
    }

    // 检查内存使用率
    if (latest.system.memoryUsage.percentage > 80) {
      alerts.push({
        type: 'warning',
        message: '内存使用率过高',
        metric: 'system.memoryUsage.percentage',
        value: latest.system.memoryUsage.percentage,
        threshold: 80
      })
    }

    // 检查批量操作队列大小
    const totalPending = latest.emailQueue.batchOperations.pendingSentEmails +
                        latest.emailQueue.batchOperations.pendingCampaignLogs +
                        latest.emailQueue.batchOperations.pendingStatsUpdates
    
    if (totalPending > 1000) {
      alerts.push({
        type: 'warning',
        message: '批量操作队列积压过多',
        metric: 'emailQueue.batchOperations.total',
        value: totalPending,
        threshold: 1000
      })
    }

    // 检查慢查询
    if (latest.database.queryStats.slowQueries > 10) {
      alerts.push({
        type: 'error',
        message: '慢查询数量过多',
        metric: 'database.queryStats.slowQueries',
        value: latest.database.queryStats.slowQueries,
        threshold: 10
      })
    }

    return { alerts }
  }

  // 重置统计数据
  resetStats(): void {
    this.queryStats = {
      totalQueries: 0,
      totalQueryTime: 0,
      slowQueries: 0
    }
    this.cacheStats = {
      hits: 0,
      misses: 0
    }
    this.metrics = []
    console.log('[PerformanceMonitor] 统计数据已重置')
  }
}

// 导出单例实例
export const performanceMonitor = PerformanceMonitor.getInstance()

// 自动启动性能监控
if (typeof window === 'undefined') { // 只在服务端启动
  performanceMonitor.startMonitoring(30000) // 30秒间隔
}