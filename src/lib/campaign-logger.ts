/**
 * 活动日志记录工具类
 * 用于统一记录活动状态变更、队列操作等关键事件
 */

export interface CampaignLogEntry {
  timestamp: Date
  campaignId: string
  action: string
  details: any
  level: 'info' | 'warn' | 'error'
  source: string
}

export class CampaignLogger {
  private static instance: CampaignLogger
  private logs: CampaignLogEntry[] = []
  private maxLogs = 1000 // 最多保存1000条日志

  private constructor() {}

  static getInstance(): CampaignLogger {
    if (!CampaignLogger.instance) {
      CampaignLogger.instance = new CampaignLogger()
    }
    return CampaignLogger.instance
  }

  /**
   * 记录活动状态变更
   */
  logStatusChange(campaignId: string, fromStatus: string, toStatus: string, source: string, details?: any) {
    this.addLog({
      campaignId,
      action: 'STATUS_CHANGE',
      details: {
        fromStatus,
        toStatus,
        ...details
      },
      level: 'info',
      source
    })

    console.log(`[活动状态] ${campaignId}: ${fromStatus} → ${toStatus} (来源: ${source})`, details)
  }

  /**
   * 记录队列操作
   */
  logQueueOperation(campaignId: string, operation: string, result: any, source: string) {
    const level = result.success ? 'info' : 'error'
    
    this.addLog({
      campaignId,
      action: `QUEUE_${operation.toUpperCase()}`,
      details: result,
      level,
      source
    })

    const status = result.success ? '成功' : '失败'
    console.log(`[队列操作] ${campaignId}: ${operation} ${status} (来源: ${source})`, result)
  }

  /**
   * 记录健康检查事件
   */
  logHealthCheck(campaignId: string, status: string, details: any, source: string) {
    const level = status === 'healthy' ? 'info' : 'warn'
    
    this.addLog({
      campaignId,
      action: 'HEALTH_CHECK',
      details: {
        status,
        ...details
      },
      level,
      source
    })

    console.log(`[健康检查] ${campaignId}: ${status} (来源: ${source})`, details)
  }

  /**
   * 记录错误事件
   */
  logError(campaignId: string, error: Error | string, source: string, context?: any) {
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined

    this.addLog({
      campaignId,
      action: 'ERROR',
      details: {
        message: errorMessage,
        stack: errorStack,
        context
      },
      level: 'error',
      source
    })

    console.error(`[错误] ${campaignId}: ${errorMessage} (来源: ${source})`, { context, stack: errorStack })
  }

  /**
   * 记录恢复操作
   */
  logRecovery(campaignId: string, recoveryType: string, result: any, source: string) {
    const level = result.success ? 'info' : 'error'
    
    this.addLog({
      campaignId,
      action: `RECOVERY_${recoveryType.toUpperCase()}`,
      details: result,
      level,
      source
    })

    const status = result.success ? '成功' : '失败'
    console.log(`[恢复操作] ${campaignId}: ${recoveryType} ${status} (来源: ${source})`, result)
  }

  /**
   * 记录前端轮询事件
   */
  logPolling(campaignId: string, pollingData: any, source: string) {
    this.addLog({
      campaignId,
      action: 'POLLING_UPDATE',
      details: pollingData,
      level: 'info',
      source
    })

    // 前端轮询日志较多，只在调试模式下输出
    if (process.env.NODE_ENV === 'development') {
      console.log(`[轮询更新] ${campaignId}:`, pollingData)
    }
  }

  /**
   * 获取指定活动的日志
   */
  getCampaignLogs(campaignId: string, limit?: number): CampaignLogEntry[] {
    const campaignLogs = this.logs
      .filter(log => log.campaignId === campaignId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    
    return limit ? campaignLogs.slice(0, limit) : campaignLogs
  }

  /**
   * 获取所有日志
   */
  getAllLogs(limit?: number): CampaignLogEntry[] {
    const sortedLogs = this.logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    
    return limit ? sortedLogs.slice(0, limit) : sortedLogs
  }

  /**
   * 清理旧日志
   */
  cleanupLogs() {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, this.maxLogs)
    }
  }

  /**
   * 添加日志条目
   */
  private addLog(entry: Omit<CampaignLogEntry, 'timestamp'>) {
    this.logs.push({
      ...entry,
      timestamp: new Date()
    })

    // 定期清理日志
    if (this.logs.length % 100 === 0) {
      this.cleanupLogs()
    }
  }

  /**
   * 导出日志为JSON格式
   */
  exportLogs(campaignId?: string): string {
    const logs = campaignId ? this.getCampaignLogs(campaignId) : this.getAllLogs()
    return JSON.stringify(logs, null, 2)
  }

  /**
   * 获取日志统计信息
   */
  getLogStats(campaignId?: string): {
    total: number
    byLevel: Record<string, number>
    byAction: Record<string, number>
    timeRange: { start: Date | null; end: Date | null }
  } {
    const logs = campaignId ? this.getCampaignLogs(campaignId) : this.getAllLogs()
    
    const byLevel: Record<string, number> = {}
    const byAction: Record<string, number> = {}
    let start: Date | null = null
    let end: Date | null = null

    logs.forEach(log => {
      // 统计级别
      byLevel[log.level] = (byLevel[log.level] || 0) + 1
      
      // 统计操作类型
      byAction[log.action] = (byAction[log.action] || 0) + 1
      
      // 计算时间范围
      if (!start || log.timestamp < start) start = log.timestamp
      if (!end || log.timestamp > end) end = log.timestamp
    })

    return {
      total: logs.length,
      byLevel,
      byAction,
      timeRange: { start, end }
    }
  }
}

// 导出单例实例
export const campaignLogger = CampaignLogger.getInstance()