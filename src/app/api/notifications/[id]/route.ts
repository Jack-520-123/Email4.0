import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 标记单个通知为已读
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const notificationId = params.id
    if (!notificationId) {
      return NextResponse.json({ error: '通知ID不能为空' }, { status: 400 })
    }

    // 验证通知是否属于当前用户
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: session.user.id
      }
    })

    if (!notification) {
      return NextResponse.json({ error: '通知不存在' }, { status: 404 })
    }

    // 标记为已读
    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(updatedNotification)
  } catch (error) {
    console.error('标记通知已读失败:', error)
    return NextResponse.json({ error: '标记通知已读失败' }, { status: 500 })
  }
}

// 删除通知
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const notificationId = params.id
    if (!notificationId) {
      return NextResponse.json({ error: '通知ID不能为空' }, { status: 400 })
    }

    // 验证通知是否属于当前用户
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: session.user.id
      }
    })

    if (!notification) {
      return NextResponse.json({ error: '通知不存在' }, { status: 404 })
    }

    // 删除通知
    await prisma.notification.delete({
      where: { id: notificationId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除通知失败:', error)
    return NextResponse.json({ error: '删除通知失败' }, { status: 500 })
  }
}