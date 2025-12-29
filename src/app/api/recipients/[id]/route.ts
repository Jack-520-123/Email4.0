import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 删除收件人
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: '收件人ID是必需的' },
        { status: 400 }
      )
    }

    // 检查收件人是否存在且属于当前用户
    const existingRecipient = await prisma.recipient.findFirst({
      where: { 
        id,
        userId: currentUser.id // 确保只能删除自己的收件人
      }
    })

    if (!existingRecipient) {
      return NextResponse.json(
        { error: '收件人不存在' },
        { status: 404 }
      )
    }

    // 删除收件人
    await prisma.recipient.delete({
      where: { id }
    })

    return NextResponse.json(
      { message: '收件人删除成功' },
      { status: 200 }
    )
  } catch (error) {
    console.error('删除收件人失败:', error)
    return NextResponse.json(
      { 
        error: '删除收件人失败', 
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// 获取单个收件人信息
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: '收件人ID是必需的' },
        { status: 400 }
      )
    }

    const recipient = await prisma.recipient.findFirst({
      where: { 
        id,
        userId: currentUser.id // 确保只能获取自己的收件人
      },
      include: {
        recipientList: {
          select: { name: true }
        }
      }
    })

    if (!recipient) {
      return NextResponse.json(
        { error: '收件人不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json(recipient)
  } catch (error) {
    console.error('获取收件人信息失败:', error)
    return NextResponse.json(
      { error: '获取收件人信息失败' },
      { status: 500 }
    )
  }
}

// 更新收件人信息
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const { id } = params
    const body = await request.json()
    const { name, email, company, recipientListId, group } = body // 新增分组字段

    if (!id) {
      return NextResponse.json(
        { error: '收件人ID是必需的' },
        { status: 400 }
      )
    }

    // 检查收件人是否存在且属于当前用户
    const existingRecipient = await prisma.recipient.findFirst({
      where: { 
        id,
        userId: currentUser.id // 确保只能更新自己的收件人
      }
    })

    if (!existingRecipient) {
      return NextResponse.json(
        { error: '收件人不存在' },
        { status: 404 }
      )
    }

    // 如果更新邮箱，检查邮箱格式和重复性
    if (email && email !== existingRecipient.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: '邮箱格式不正确' },
          { status: 400 }
        )
      }

      // 检查邮箱是否已存在于同一分组中 - 添加用户隔离
      const duplicateRecipient = await prisma.recipient.findFirst({
        where: {
          email,
          recipientListId: recipientListId || existingRecipient.recipientListId,
          group: group !== undefined ? group : existingRecipient.group, // 按分组进行去重检查
          userId: currentUser.id, // 只在当前用户的收件人中检查
          id: { not: id }
        }
      })

      if (duplicateRecipient) {
        const groupInfo = (group !== undefined ? group : existingRecipient.group) ? `分组"${group !== undefined ? group : existingRecipient.group}"` : '无分组'
        return NextResponse.json(
          { error: `该邮箱已存在于${groupInfo}中` },
          { status: 400 }
        )
      }
    }

    // 更新收件人
    const updatedRecipient = await prisma.recipient.update({
      where: { id },
      data: {
        ...(email && { email }),
        ...(name && { name }),
        ...(company !== undefined && { company }),
        ...(group !== undefined && { group }),
        ...(recipientListId && { recipientListId })
      },
      include: {
        recipientList: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json(updatedRecipient)
  } catch (error) {
    console.error('更新收件人失败:', error)
    return NextResponse.json(
      { error: '更新收件人失败' },
      { status: 500 }
    )
  }
}