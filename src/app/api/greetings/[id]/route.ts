import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 更新问候语
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { content } = await request.json()
    const greetingId = params.id
    const userId = session.user.id

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: '问候语内容不能为空' },
        { status: 400 }
      )
    }

    // 检查问候语是否存在（用户问候语或默认问候语）
    const existingGreeting = await prisma.greeting.findFirst({
      where: {
        id: greetingId,
        OR: [
          { userId: userId },
          { userId: null, isDefault: true }
        ]
      }
    })

    if (!existingGreeting) {
      return NextResponse.json(
        { error: '问候语不存在' },
        { status: 404 }
      )
    }

    // 检查是否已存在相同内容的其他问候语
    const duplicateGreeting = await prisma.greeting.findFirst({
      where: {
        OR: [
          { userId: userId, content: content.trim(), isActive: true },
          { userId: null, isDefault: true, content: content.trim(), isActive: true }
        ],
        id: {
          not: greetingId
        }
      }
    })

    if (duplicateGreeting) {
      return NextResponse.json(
        { error: '该问候语已存在' },
        { status: 400 }
      )
    }

    let updatedGreeting
    
    if (existingGreeting.isDefault) {
      // 如果是默认问候语，为用户创建一个自定义版本
      updatedGreeting = await prisma.greeting.create({
        data: {
          userId: userId,
          content: content.trim(),
          isDefault: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      
      // 同时隐藏原默认问候语
      await prisma.greeting.create({
        data: {
          userId: userId,
          content: existingGreeting.content,
          isDefault: false,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    } else {
      // 如果是用户自定义问候语，直接更新
      updatedGreeting = await prisma.greeting.update({
        where: {
          id: greetingId
        },
        data: {
          content: content.trim(),
          updatedAt: new Date()
        }
      })
    }

    return NextResponse.json(updatedGreeting)
  } catch (error) {
    console.error('更新问候语失败:', error)
    return NextResponse.json(
      { error: '更新问候语失败' },
      { status: 500 }
    )
  }
}

// 删除问候语
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const greetingId = params.id
    const userId = session.user.id

    // 检查问候语是否存在（用户问候语或默认问候语）
    const existingGreeting = await prisma.greeting.findFirst({
      where: {
        id: greetingId,
        OR: [
          { userId: userId },
          { userId: null, isDefault: true }
        ]
      }
    })

    if (!existingGreeting) {
      return NextResponse.json(
        { error: '问候语不存在' },
        { status: 404 }
      )
    }

    // 如果是默认问候语，只有当前用户可以删除（对当前用户隐藏）
    if (existingGreeting.isDefault) {
      // 为当前用户创建一个禁用记录，实现个性化隐藏
      await prisma.greeting.create({
        data: {
          userId: userId,
          content: existingGreeting.content,
          isDefault: false,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    } else {
      // 用户自定义问候语直接删除
      await prisma.greeting.delete({
        where: {
          id: greetingId
        }
      })
    }

    return NextResponse.json({ message: '问候语删除成功' })
  } catch (error) {
    console.error('删除问候语失败:', error)
    return NextResponse.json(
      { error: '删除问候语失败' },
      { status: 500 }
    )
  }
}

// 获取单个问候语
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const greetingId = params.id
    const userId = session.user.id

    const greeting = await prisma.greeting.findFirst({
      where: {
        id: greetingId,
        OR: [
          { userId: userId },
          { userId: null, isDefault: true }
        ],
        isActive: true
      }
    })

    if (!greeting) {
      return NextResponse.json(
        { error: '问候语不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json(greeting)
  } catch (error) {
    console.error('获取问候语失败:', error)
    return NextResponse.json(
      { error: '获取问候语失败' },
      { status: 500 }
    )
  }
}