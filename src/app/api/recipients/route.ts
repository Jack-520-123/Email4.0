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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const listId = searchParams.get('listId')
    const group = searchParams.get('group') // 新增分组筛选
    const groups = searchParams.getAll('groups[]') // 多选分组筛选

    const skip = (page - 1) * limit

    // 构建查询条件 - 添加用户隔离
    const where: any = {
      userId: currentUser.id // 确保用户只能看到自己的收件人
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { group: { contains: search, mode: 'insensitive' } } // 支持按分组搜索
      ]
    }

    if (listId) {
      where.recipientListId = listId
    }

    if (group) {
      where.group = group // 按分组筛选
    }

    // 支持多选分组筛选
    if (groups && groups.length > 0) {
      where.group = {
        in: groups
      }
    }

    const [recipients, total] = await Promise.all([
      prisma.recipient.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], // 优先按序号排序，然后按创建时间
        include: {
          recipientList: {
            select: { name: true }
          }
        }
      }),
      prisma.recipient.count({ where })
    ])

    return NextResponse.json({
      recipients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('获取收件人列表失败:', error)
    return NextResponse.json({ error: '获取收件人列表失败' }, { status: 500 })
  }
}

// 添加收件人
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const body = await request.json()
    const { email, name, recipientListId, company, group, website } = body // 新增分组字段和主页链接字段

    if (!email || !name || !recipientListId) {
      return NextResponse.json(
        { error: '邮箱地址、姓名和收件人列表是必需的' },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      )
    }

    // 检查邮箱是否已存在于同一分组中 - 添加用户隔离
    const existingRecipient = await prisma.recipient.findFirst({
      where: {
        email,
        recipientListId,
        group: group || null, // 按分组进行去重检查
        userId: currentUser.id // 只在当前用户的收件人中检查
      }
    })

    if (existingRecipient) {
      const groupInfo = group ? `分组"${group}"` : '无分组'
      return NextResponse.json(
        { error: `该邮箱已存在于${groupInfo}中` },
        { status: 400 }
      )
    }

    // 获取该列表中当前最大的序号
    const maxSortOrder = await prisma.recipient.aggregate({
      where: {
        recipientListId,
        userId: currentUser.id
      },
      _max: {
        sortOrder: true
      }
    })

    const nextSortOrder = (maxSortOrder._max.sortOrder || 0) + 1

    const recipient = await prisma.recipient.create({
      data: {
        email,
        name,
        recipientListId,
        company: company || null,
        group: group || null, // 新增分组字段
        website: website || null, // 新增主页链接字段
        sortOrder: nextSortOrder, // 自动分配序号
        userId: currentUser.id // 确保收件人属于当前用户
      },
      include: {
        recipientList: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json(recipient, { status: 201 })
  } catch (error) {
    console.error('添加收件人失败:', error)
    return NextResponse.json({ error: '添加收件人失败' }, { status: 500 })
  }
}