import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEmailMonitorManager } from '@/lib/email-monitor'

const monitorManager = getEmailMonitorManager()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 检查是否正在运行
    const status = monitorManager.getStatus()
    if (!status.isRunning) {
      return NextResponse.json({
        success: true,
        message: '邮件监听服务已停止',
        data: {
          status: 'already_stopped',
          monitorCount: 0
        }
      })
    }

    // 停止监听服务
    await monitorManager.stopMonitoring()
    
    // 等待一小段时间确保服务停止
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const newStatus = monitorManager.getStatus()
    
    return NextResponse.json({
      success: true,
      message: '邮件监听服务已停止',
      data: {
        status: 'stopped',
        monitorCount: newStatus.monitorCount,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('停止邮件监听服务失败:', error)
    return NextResponse.json({
      success: false,
      error: '停止邮件监听服务失败: ' + (error instanceof Error ? error.message : '未知错误')
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const status = monitorManager.getStatus()
    
    return NextResponse.json({
      success: true,
      data: {
        isRunning: status.isRunning,
        monitorCount: status.monitorCount,
        status: status.isRunning ? 'running' : 'stopped',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('获取监听状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取监听状态失败: ' + (error instanceof Error ? error.message : '未知错误')
    }, { status: 500 })
  }
}