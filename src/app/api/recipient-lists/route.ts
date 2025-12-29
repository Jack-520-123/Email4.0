import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 获取收件人列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }

    const lists = await prisma.recipientList.findMany({
      where: { userId: currentUser.id }, // 只获取当前用户的列表
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { recipients: true }
        }
      }
    })

    return NextResponse.json({ lists })
  } catch (error) {
    console.error('获取收件人列表失败', error)
    return NextResponse.json({ error: '获取收件人列表失败' }, { status: 500 })
  }
}

// 创建收件人列表
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }
    const { name, description } = await request.json()

    if (!name) {
      return NextResponse.json({ error: '列表名称不能为空' }, { status: 400 })
    }

    const list = await prisma.recipientList.create({
      data: {
        name,
        description: description || '',
        userId: currentUser.id
      }
    })

    return NextResponse.json({ list })
  } catch (error) {
    console.error('创建收件人列表失败', error)
    return NextResponse.json({ error: '创建收件人列表失败' }, { status: 500 })
  }
}

// 删除收件人列表
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: '列表ID不能为空' }, { status: 400 })
    }

    // 检查列表是否属于当前用户
    const list = await prisma.recipientList.findFirst({
      where: {
        id,
        userId: currentUser.id
      }
    })

    if (!list) {
      return NextResponse.json({ error: '列表不存在或无权限' }, { status: 404 })
    }

    await prisma.recipientList.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除收件人列表失败', error)
    return NextResponse.json({ error: '删除收件人列表失败' }, { status: 500 })
  }
}