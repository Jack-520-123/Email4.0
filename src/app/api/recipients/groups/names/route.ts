import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 获取所有分组名称
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    // 获取所有不为空的分组名称
    const groups = await prisma.recipient.findMany({
      where: {
        userId: currentUser.id,
        group: {
          not: null
        },
        NOT: {
          group: ''
        }
      },
      select: {
        group: true
      },
      distinct: ['group'],
      orderBy: {
        group: 'asc'
      }
    })

    const groupNames = groups.map(g => g.group).filter(Boolean)

    return NextResponse.json({
      groups: groupNames
    })
  } catch (error) {
    console.error('获取分组名称失败:', error)
    return NextResponse.json({ error: '获取分组名称失败' }, { status: 500 })
  }
}