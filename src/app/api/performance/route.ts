import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { performanceMonitor } from '@/lib/performance-monitor'
import { queryOptimization } from '@/lib/query-optimization'
import { batchDB } from '@/lib/batch-db-operations'

// 获取性能监控数据
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      )
    }

    // 只有管理员可以查看性能数据
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const limit = searchParams.get('limit')

    switch (action) {
      case 'latest':
        const latestMetrics = performanceMonitor.getLatestMetrics()
        return NextResponse.json({
          success: true,
          data: latestMetrics
        })

      case 'history':
        const historyLimit = limit ? parseInt(limit) : undefined
        const history = performanceMonitor.getMetricsHistory(historyLimit)
        return NextResponse.json({
          success: true,
          data: history
        })

      case 'summary':
        const summary = performanceMonitor.getPerformanceSummary()
        return NextResponse.json({
          success: true,
          data: summary
        })

      case 'alerts':
        const alerts = performanceMonitor.checkPerformanceAlerts()
        return NextResponse.json({
          success: true,
          data: alerts
        })

      case 'batch-stats':
        const batchStats = batchDB.getStats()
        return NextResponse.json({
          success: true,
          data: batchStats
        })

      case 'db-stats':
        const dbStats = await queryOptimization.getDatabaseConnectionStatus()
        return NextResponse.json({
          success: true,
          data: dbStats
        })

      default:
        // 默认返回最新指标
        const defaultMetrics = performanceMonitor.getLatestMetrics()
        return NextResponse.json({
          success: true,
          data: defaultMetrics
        })
    }
  } catch (error) {
    console.error('[Performance API] 获取性能数据失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '获取性能数据失败' 
      },
      { status: 500 }
    )
  }
}

// 性能监控控制
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      )
    }

    // 只有管理员可以控制性能监控
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, interval } = body

    switch (action) {
      case 'start':
        const monitorInterval = interval || 30000
        performanceMonitor.startMonitoring(monitorInterval)
        return NextResponse.json({
          success: true,
          message: `性能监控已启动，间隔: ${monitorInterval}ms`
        })

      case 'stop':
        performanceMonitor.stopMonitoring()
        return NextResponse.json({
          success: true,
          message: '性能监控已停止'
        })

      case 'reset':
        performanceMonitor.resetStats()
        return NextResponse.json({
          success: true,
          message: '性能统计数据已重置'
        })

      case 'flush-batch':
        await batchDB.forceFlush()
        return NextResponse.json({
          success: true,
          message: '批量操作已强制刷新'
        })

      case 'clear-cache':
        const pattern = body.pattern
        queryOptimization.clearCache(pattern)
        return NextResponse.json({
          success: true,
          message: pattern ? `已清除匹配 "${pattern}" 的缓存` : '已清除所有缓存'
        })

      default:
        return NextResponse.json(
          { error: '无效的操作' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[Performance API] 性能监控控制失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '性能监控控制失败' 
      },
      { status: 500 }
    )
  }
}