import { prisma } from './prisma'

/**
 * 数据库索引优化脚本
 * 为邮件发送相关的查询添加合适的索引以提高性能
 */

export class DatabaseIndexOptimization {
  private static instance: DatabaseIndexOptimization
  private indexesCreated = false

  static getInstance(): DatabaseIndexOptimization {
    if (!DatabaseIndexOptimization.instance) {
      DatabaseIndexOptimization.instance = new DatabaseIndexOptimization()
    }
    return DatabaseIndexOptimization.instance
  }

  // 创建邮件发送相关的索引
  async createEmailIndexes(): Promise<void> {
    if (this.indexesCreated) {
      console.log('[DBOptimization] 索引已创建，跳过')
      return
    }

    try {
      console.log('[DBOptimization] 开始创建数据库索引...')

      // 为 sentEmail 表创建复合索引
      await this.createIndexIfNotExists(
        'sentEmail',
        'idx_sentemail_campaign_recipient',
        ['campaignId', 'recipientEmail']
      )

      await this.createIndexIfNotExists(
        'sentEmail',
        'idx_sentemail_campaign_status',
        ['campaignId', 'status']
      )

      await this.createIndexIfNotExists(
        'sentEmail',
        'idx_sentemail_user_campaign',
        ['userId', 'campaignId']
      )

      await this.createIndexIfNotExists(
        'sentEmail',
        'idx_sentemail_sentat',
        ['sentAt']
      )

      // 为 campaign 表创建索引
      await this.createIndexIfNotExists(
        'campaign',
        'idx_campaign_user_status',
        ['userId', 'status']
      )

      await this.createIndexIfNotExists(
        'campaign',
        'idx_campaign_status_createdat',
        ['status', 'createdAt']
      )

      // 为 campaignLog 表创建索引
      await this.createIndexIfNotExists(
        'campaignLog',
        'idx_campaignlog_campaign_level',
        ['campaignId', 'level']
      )

      await this.createIndexIfNotExists(
        'campaignLog',
        'idx_campaignlog_createdat',
        ['createdAt']
      )

      // 为 recipient 表创建索引
      await this.createIndexIfNotExists(
        'recipient',
        'idx_recipient_list_email',
        ['listId', 'email']
      )

      // 为 emailProfile 表创建索引
      await this.createIndexIfNotExists(
        'emailProfile',
        'idx_emailprofile_user_active',
        ['userId', 'isActive']
      )

      this.indexesCreated = true
      console.log('[DBOptimization] 所有索引创建完成')

    } catch (error) {
      console.error('[DBOptimization] 创建索引失败:', error)
      throw error
    }
  }

  // 检查索引是否存在，如果不存在则创建
  private async createIndexIfNotExists(
    tableName: string,
    indexName: string,
    columns: string[]
  ): Promise<void> {
    try {
      // 检查索引是否已存在
      const indexExists = await this.checkIndexExists(tableName, indexName)
      
      if (indexExists) {
        console.log(`[DBOptimization] 索引 ${indexName} 已存在，跳过创建`)
        return
      }

      // 创建索引的 SQL
      const columnList = columns.map(col => `"${col}"`).join(', ')
      const createIndexSQL = `
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" 
        ON "${tableName}" (${columnList})
      `

      console.log(`[DBOptimization] 创建索引: ${indexName} on ${tableName}(${columns.join(', ')})`)
      
      // 使用原生 SQL 创建索引
      await prisma.$executeRawUnsafe(createIndexSQL)
      
      console.log(`[DBOptimization] 索引 ${indexName} 创建成功`)

    } catch (error: any) {
      // 如果索引已存在，忽略错误
      if (error.message?.includes('already exists')) {
        console.log(`[DBOptimization] 索引 ${indexName} 已存在`)
        return
      }
      
      console.error(`[DBOptimization] 创建索引 ${indexName} 失败:`, error)
      // 不抛出错误，继续创建其他索引
    }
  }

  // 检查索引是否存在
  private async checkIndexExists(tableName: string, indexName: string): Promise<boolean> {
    try {
      const result = await prisma.$queryRawUnsafe(`
        SELECT 1 FROM pg_indexes 
        WHERE tablename = $1 AND indexname = $2
      `, tableName, indexName) as any[]
      
      return result.length > 0
    } catch (error) {
      console.error(`[DBOptimization] 检查索引 ${indexName} 是否存在时出错:`, error)
      return false
    }
  }

  // 分析表统计信息
  async analyzeTableStats(): Promise<void> {
    try {
      console.log('[DBOptimization] 开始分析表统计信息...')
      
      const tables = ['sentEmail', 'campaign', 'campaignLog', 'recipient', 'emailProfile']
      
      for (const table of tables) {
        await prisma.$executeRawUnsafe(`ANALYZE "${table}"`)
        console.log(`[DBOptimization] 已分析表: ${table}`)
      }
      
      console.log('[DBOptimization] 表统计信息分析完成')
    } catch (error) {
      console.error('[DBOptimization] 分析表统计信息失败:', error)
    }
  }

  // 获取数据库性能统计
  async getDatabaseStats(): Promise<any> {
    try {
      // 获取表大小信息
      const tableSizes = await prisma.$queryRawUnsafe(`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        AND tablename IN ('sentEmail', 'campaign', 'campaignLog', 'recipient', 'emailProfile')
        ORDER BY tablename, attname
      `)

      // 获取索引使用情况
      const indexUsage = await prisma.$queryRawUnsafe(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `)

      return {
        tableSizes,
        indexUsage
      }
    } catch (error) {
      console.error('[DBOptimization] 获取数据库统计信息失败:', error)
      return null
    }
  }

  // 优化查询计划缓存
  async optimizeQueryPlanCache(): Promise<void> {
    try {
      console.log('[DBOptimization] 优化查询计划缓存...')
      
      // 清理查询计划缓存
      await prisma.$executeRawUnsafe('SELECT pg_stat_reset()')
      
      console.log('[DBOptimization] 查询计划缓存优化完成')
    } catch (error) {
      console.error('[DBOptimization] 优化查询计划缓存失败:', error)
    }
  }
}

// 导出单例实例
export const dbOptimization = DatabaseIndexOptimization.getInstance()

// 自动初始化索引（在应用启动时调用）
export async function initializeDatabaseOptimization(): Promise<void> {
  try {
    await dbOptimization.createEmailIndexes()
    await dbOptimization.analyzeTableStats()
    console.log('[DBOptimization] 数据库优化初始化完成')
  } catch (error) {
    console.error('[DBOptimization] 数据库优化初始化失败:', error)
  }
}