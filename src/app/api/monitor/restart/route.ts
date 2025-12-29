import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEmailMonitorManager } from '@/lib/email-monitor'
import { prisma } from '@/lib/prisma'

const monitorManager = getEmailMonitorManager()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 检查用户是否有配置的邮箱
    const emailProfiles = await prisma.emailProfile.findMany({
      where: {
        userId: session.user.id,
        enableMonitoring: true,
        imapServer: { not: null },
        imapPort: { not: null }
      }
    })

    if (emailProfiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有找到已配置的邮箱监听设置，请先配置邮箱信息'
      }, { status: 400 })
    }

    // 获取当前状态
    const currentStatus = monitorManager.getStatus()
    
    // 停止监听服务（如果正在运行）
    if (currentStatus.isRunning) {
      await monitorManager.stopMonitoring()
      // 等待停止完成
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // 启动监听服务
    await monitorManager.startMonitoring()
    
    // 等待启动完成
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const newStatus = monitorManager.getStatus()
    
    return NextResponse.json({
      success: true,
      message: '邮件监听服务重启成功',
      data: {
        status: 'restarted',
        monitorCount: newStatus.monitorCount,
        configuredProfiles: emailProfiles.length,
        previousStatus: currentStatus.isRunning ? 'running' : 'stopped',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('重启邮件监听服务失败:', error)
    return NextResponse.json({
      success: false,
      error: '重启邮件监听服务失败: ' + (error instanceof Error ? error.message : '未知错误')
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