import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 获取分组聚合数据
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

    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = {
      userId: currentUser.id,
      group: {
        not: null
      },
      NOT: {
        group: ''
      }
    }

    if (search) {
      where.OR = [
        { group: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (listId) {
      where.recipientListId = listId
    }

    // 获取分组聚合数据
    const groupStats = await prisma.recipient.groupBy({
      by: ['group', 'recipientListId'],
      where,
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })

    // 获取每个分组的详细信息（第一个收件人作为代表）
    const groupDetails = await Promise.all(
      groupStats.map(async (stat) => {
        const representative = await prisma.recipient.findFirst({
          where: {
            userId: currentUser.id,
            group: stat.group,
            recipientListId: stat.recipientListId
          },
          include: {
            recipientList: {
              select: { name: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        })

        return {
          id: `group_${stat.group}_${stat.recipientListId}`,
          name: representative?.name || '未知',
          email: `${stat._count.id}个收件人`,
          company: representative?.company || '-',
          group: stat.group,
          recipientList: representative?.recipientList || { name: '未知列表' },
          createdAt: representative?.createdAt || new Date(),
          count: stat._count.id,
          isGroup: true
        }
      })
    )

    // 分页处理
    const total = groupDetails.length
    const paginatedGroups = groupDetails.slice(skip, skip + limit)

    return NextResponse.json({
      recipients: paginatedGroups,
      groups: paginatedGroups, // 为兼容性添加groups字段
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('获取分组数据失败:', error)
    return NextResponse.json({ error: '获取分组数据失败' }, { status: 500 })
  }
}