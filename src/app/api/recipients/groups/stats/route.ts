import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

// 强制动态渲染
export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 获取当前用户的所有收件人，按分组统计数量
    const groupStats = await prisma.recipient.groupBy({
      by: ['group'],
      where: {
        user: {
          email: session.user.email
        },
        group: {
          not: null
        },
        NOT: {
          group: ''
        }
      },
      _count: {
        id: true
      }
    })

    // 转换为 { groupName: count } 格式
    const groupCounts: Record<string, number> = {}
    groupStats.forEach(stat => {
      if (stat.group) {
        groupCounts[stat.group] = stat._count.id
      }
    })

    return NextResponse.json({ groupCounts })
  } catch (error) {
    console.error('获取分组统计失败:', error)
    return NextResponse.json(
      { error: '获取分组统计失败' },
      { status: 500 }
    )
  }
}