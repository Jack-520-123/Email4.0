import { TaskRecoveryService } from './task-recovery'
import { warmupRecoveryService } from './warmup-recovery'
import { initializeDatabaseOptimization } from './db-index-optimization'

// 应用初始化标志
let isInitialized = false

// 应用启动初始化函数
export async function initializeApp() {
  if (isInitialized) {
    console.log('[AppInitializer] 应用已初始化，跳过重复初始化')
    return
  }

  console.log('[AppInitializer] 开始应用初始化（递归模式）...')
  
  try {
    // 初始化数据库优化（索引和连接池）
    await initializeDatabaseOptimization()
    
    // 初始化任务恢复服务（队列模式）
    const taskRecoveryService = TaskRecoveryService.getInstance()
    await taskRecoveryService.initialize()
    
    // 初始化预热任务恢复服务
    await warmupRecoveryService.initialize()
    
    isInitialized = true
    console.log('[AppInitializer] 应用初始化完成（递归模式）')
  } catch (error) {
    console.error('[AppInitializer] 应用初始化失败:', error)
    // 不抛出错误，避免影响应用启动
  }
}

// 检查是否已初始化
export function isAppInitialized(): boolean {
  return isInitialized
}

// 关闭应用服务
export async function shutdownApp() {
  if (!isInitialized) {
    console.log('[AppInitializer] 应用未初始化，无需关闭')
    return
  }

  console.log('[AppInitializer] 开始关闭应用服务...')
  
  try {
    // 停止任务恢复服务
    const taskRecoveryService = TaskRecoveryService.getInstance()
    await taskRecoveryService.shutdown()
    
    // 停止预热任务恢复服务
    await warmupRecoveryService.shutdown()
    
    isInitialized = false
    console.log('[AppInitializer] 应用服务已关闭')
  } catch (error) {
    console.error('[AppInitializer] 关闭应用服务失败:', error)
  }
}

// 重置初始化状态（用于测试）
export function resetInitialization() {
  isInitialized = false
}