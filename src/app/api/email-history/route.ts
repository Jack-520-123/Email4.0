import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // 获取发送历史记录
    const emailHistory = await prisma.sentEmail.findMany({
      where: {
        userId: currentUser.id
      },
      include: {
        template: {
          select: {
            name: true,
            subject: true
          }
        }
      },
      orderBy: {
        sentAt: 'desc'
      },
      skip,
      take: limit
    })

    // 获取总数
    const total = await prisma.sentEmail.count({
      where: {
        userId: currentUser.id
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        history: emailHistory,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('获取邮件发送历史失败:', error)
    return NextResponse.json(
      { error: '获取邮件发送历史失败' },
      { status: 500 }
    )
  }
}

// 获取单个发送历史详情
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }
    const { historyId } = await request.json()

    if (!historyId) {
      return NextResponse.json({ error: '历史记录ID不能为空' }, { status: 400 })
    }

    const history = await prisma.sentEmail.findFirst({
      where: {
        id: historyId,
        userId: currentUser.id
      },
      include: {
        template: true,
        replies: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!history) {
      return NextResponse.json(
        { error: '历史记录不存在或无权限' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: history
    })

  } catch (error) {
    console.error('获取邮件发送历史详情失败:', error)
    return NextResponse.json(
      { error: '获取邮件发送历史详情失败' },
      { status: 500 }
    )
  }
}