import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 获取特定分组的成员详情
export async function GET(
  request: NextRequest,
  { params }: { params: { groupName: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    const groupName = decodeURIComponent(params.groupName)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const listId = searchParams.get('listId')

    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = {
      userId: currentUser.id,
      group: groupName
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (listId) {
      where.recipientListId = listId
    }

    // 获取总数
    const total = await prisma.recipient.count({ where })

    // 获取分页数据
    const recipients = await prisma.recipient.findMany({
      where,
      include: {
        recipientList: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })

    return NextResponse.json({
      recipients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      groupName
    })
  } catch (error) {
    console.error('获取分组成员失败:', error)
    return NextResponse.json({ error: '获取分组成员失败' }, { status: 500 })
  }
}