import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/recipient-lists/[id] - 获取单个收件人列表
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const list = await prisma.recipientList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        _count: {
          select: {
            recipients: true,
          },
        },
        recipients: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!list) {
      return NextResponse.json({ error: '列表不存在' }, { status: 404 })
    }

    return NextResponse.json({ list })
  } catch (error) {
    console.error('获取收件人列表失败:', error)
    return NextResponse.json(
      { error: '获取收件人列表失败' },
      { status: 500 }
    )
  }
}

// PUT /api/recipient-lists/[id] - 更新收件人列表
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { name, description } = await request.json()

    // 验证必需字段
    if (!name) {
      return NextResponse.json(
        { error: '列表名称不能为空' },
        { status: 400 }
      )
    }

    // 检查列表是否存在且属于当前用户
    const existingList = await prisma.recipientList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existingList) {
      return NextResponse.json({ error: '列表不存在' }, { status: 404 })
    }

    // 检查名称是否与其他列表重复
    const duplicateList = await prisma.recipientList.findFirst({
      where: {
        name,
        userId: session.user.id,
        id: {
          not: params.id,
        },
      },
    })

    if (duplicateList) {
      return NextResponse.json(
        { error: '列表名称已存在' },
        { status: 400 }
      )
    }

    // 更新列表
    const updatedList = await prisma.recipientList.update({
      where: {
        id: params.id,
      },
      data: {
        name,
        description,
      },
      include: {
        _count: {
          select: {
            recipients: true,
          },
        },
      },
    })

    return NextResponse.json({ list: updatedList })
  } catch (error) {
    console.error('更新收件人列表失败:', error)
    return NextResponse.json(
      { error: '更新收件人列表失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/recipient-lists/[id] - 删除收件人列表
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查列表是否存在且属于当前用户
    const existingList = await prisma.recipientList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existingList) {
      return NextResponse.json({ error: '列表不存在' }, { status: 404 })
    }

    // 删除列表（会级联删除相关的收件人）
    await prisma.recipientList.delete({
      where: {
        id: params.id,
      },
    })

    return NextResponse.json({ message: '列表删除成功' })
  } catch (error) {
    console.error('删除收件人列表失败:', error)
    return NextResponse.json(
      { error: '删除收件人列表失败' },
      { status: 500 }
    )
  }
}