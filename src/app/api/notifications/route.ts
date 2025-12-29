import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 获取通知列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where = {
      userId: currentUser.id,
      ...(unreadOnly && { isRead: false })
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.notification.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        total,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('获取通知失败:', error)
    return NextResponse.json(
      { error: '获取通知失败' },
      { status: 500 }
    )
  }
}

// 标记通知为已读
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }
    const { notificationIds, markAllAsRead } = await request.json()

    if (markAllAsRead) {
      // 标记所有通知为已读
      await prisma.notification.updateMany({
        where: {
          userId: currentUser.id,
          isRead: false
        },
        data: {
          isRead: true
        }
      })
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // 标记指定通知为已读
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: currentUser.id
        },
        data: {
          isRead: true
        }
      })
    } else {
      return NextResponse.json(
        { error: '参数无效' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '通知状态更新成功'
    })

  } catch (error) {
    console.error('更新通知状态失败:', error)
    return NextResponse.json(
      { error: '更新通知状态失败' },
      { status: 500 }
    )
  }
}

// 删除通知
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }
    const { notificationIds } = await request.json()

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json(
        { error: '参数无效' },
        { status: 400 }
      )
    }

    await prisma.notification.deleteMany({
      where: {
        id: { in: notificationIds },
        userId: currentUser.id
      }
    })

    return NextResponse.json({
      success: true,
      message: '通知删除成功'
    })

  } catch (error) {
    console.error('删除通知失败:', error)
    return NextResponse.json(
      { error: '删除通知失败' },
      { status: 500 }
    )
  }
}