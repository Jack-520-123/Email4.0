import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

// 创建对话线程的验证模式
const createThreadSchema = z.object({
  replyIds: z.array(z.string()).min(1),
  threadName: z.string().optional()
})

// 合并对话线程的验证模式
const mergeThreadSchema = z.object({
  sourceThreadId: z.string(),
  targetThreadId: z.string()
})

// 分离回复的验证模式
const separateReplySchema = z.object({
  replyId: z.string(),
  newThreadName: z.string().optional()
})

// 获取对话线程列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const assignedTo = searchParams.get('assignedTo')
    const category = searchParams.get('category')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)

    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = {
      userId: currentUser.id,
      threadId: { not: null }
    }

    if (status) where.status = status
    if (priority) where.priority = priority
    if (assignedTo) where.assignedTo = assignedTo
    if (category) where.category = category
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags }
    }

    // 获取线程根回复（没有父回复的回复）
    const threads = await prisma.emailReply.findMany({
      where: {
        ...where,
        parentReplyId: null
      },
      include: {
        sentEmail: {
          select: {
            recipientEmail: true,
            recipientName: true,
            subject: true,
            campaign: {
              select: {
                name: true
              }
            }
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        childReplies: {
          include: {
            childReplies: true
          },
          orderBy: {
            receivedAt: 'asc'
          }
        }
      },
      orderBy: {
        lastReplyAt: 'desc'
      },
      skip,
      take: limit
    })

    const total = await prisma.emailReply.count({
      where: {
        ...where,
        parentReplyId: null
      }
    })

    // 计算每个线程的统计信息
    const threadsWithStats = threads.map(thread => {
      const getAllReplies = (reply: any): any[] => {
        const replies = [reply]
        if (reply.childReplies) {
          reply.childReplies.forEach((child: any) => {
            replies.push(...getAllReplies(child))
          })
        }
        return replies
      }

      const allReplies = getAllReplies(thread)
      const unreadCount = allReplies.filter(r => !r.isRead).length
      const lastActivity = Math.max(...allReplies.map(r => new Date(r.receivedAt).getTime()))

      return {
        ...thread,
        replyCount: allReplies.length,
        unreadCount,
        lastActivity: new Date(lastActivity)
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        threads: threadsWithStats,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('获取对话线程失败:', error)
    return NextResponse.json(
      { error: '获取对话线程失败' },
      { status: 500 }
    )
  }
}

// 创建对话线程
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const body = await request.json()
    const { replyIds, threadName } = createThreadSchema.parse(body)

    // 验证所有回复都属于当前用户
    const replies = await prisma.emailReply.findMany({
      where: {
        id: { in: replyIds },
        userId: currentUser.id
      }
    })

    if (replies.length !== replyIds.length) {
      return NextResponse.json(
        { error: '部分回复不存在或无权限' },
        { status: 400 }
      )
    }

    // 生成线程ID
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 更新回复的线程ID
    await prisma.emailReply.updateMany({
      where: {
        id: { in: replyIds }
      },
      data: {
        threadId,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        threadId,
        message: `成功创建对话线程，包�?${replyIds.length} 个回复`
      }
    })
  } catch (error) {
    console.error('创建对话线程失败:', error)
    return NextResponse.json(
      { error: '创建对话线程失败' },
      { status: 500 }
    )
  }
}

// 更新对话线程（合并、分离等操作）
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'merge': {
        const { sourceThreadId, targetThreadId } = mergeThreadSchema.parse(body)
        
        // 将源线程的所有回复合并到目标线程
        await prisma.emailReply.updateMany({
          where: {
            threadId: sourceThreadId,
            userId: currentUser.id
          },
          data: {
            threadId: targetThreadId,
            updatedAt: new Date()
          }
        })

        return NextResponse.json({
          success: true,
          message: '对话线程合并成功'
        })
      }

      case 'separate': {
        const { replyId, newThreadName } = separateReplySchema.parse(body)
        
        // 生成新的线程ID
        const newThreadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // 将指定回复及其子回复分离到新线程
        const reply = await prisma.emailReply.findFirst({
          where: {
            id: replyId,
            userId: currentUser.id
          },
          include: {
            childReplies: true
          }
        })

        if (!reply) {
          return NextResponse.json(
            { error: '回复不存在或无权限' },
            { status: 400 }
          )
        }

        // 获取所有需要移动的回复ID（包括子回复）
        const getAllChildIds = (replyWithChildren: any): string[] => {
          const ids = [replyWithChildren.id]
          if (replyWithChildren.childReplies) {
            replyWithChildren.childReplies.forEach((child: any) => {
              ids.push(...getAllChildIds(child))
            })
          }
          return ids
        }

        const replyIdsToMove = getAllChildIds(reply)

        await prisma.emailReply.updateMany({
          where: {
            id: { in: replyIdsToMove }
          },
          data: {
            threadId: newThreadId,
            parentReplyId: null, // 重置父回复关�?            updatedAt: new Date()
          }
        })

        return NextResponse.json({
          success: true,
          data: {
            newThreadId,
            message: `成功分离 ${replyIdsToMove.length} 个回复到新线程`
          }
        })
      }

      default:
        return NextResponse.json(
          { error: '不支持的操作' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('更新对话线程失败:', error)
    return NextResponse.json(
      { error: '更新对话线程失败' },
      { status: 500 }
    )
  }
}