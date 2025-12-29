import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

// 添加标签的验证模式
const addTagsSchema = z.object({
  replyIds: z.array(z.string()).min(1),
  tags: z.array(z.string()).min(1)
})

// 移除标签的验证模式
const removeTagsSchema = z.object({
  replyIds: z.array(z.string()).min(1),
  tags: z.array(z.string()).min(1)
})

// 创建预设标签的验证模式
const createPresetTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  description: z.string().optional()
})

// 获取标签统计和预设标签
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'stats'

    if (type === 'stats') {
      // 获取标签使用统计
      const replies = await prisma.emailReply.findMany({
        where: {
          userId: currentUser.id,
          NOT: {
            tags: {
              isEmpty: true
            }
          }
        },
        select: {
          tags: true
        }
      })

      // 统计标签使用频率
      const tagStats: Record<string, number> = {}
      replies.forEach(reply => {
        reply.tags.forEach(tag => {
          tagStats[tag] = (tagStats[tag] || 0) + 1
        })
      })

      // 按使用频率排序
      const sortedTags = Object.entries(tagStats)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)

      return NextResponse.json({
        success: true,
        data: {
          tagStats: sortedTags,
          totalTags: sortedTags.length,
          totalUsage: Object.values(tagStats).reduce((sum, count) => sum + count, 0)
        }
      })
    }

    if (type === 'presets') {
      // 获取预设标签（这里可以扩展为数据库存储的预设标签）
      const presetTags = [
        { name: '紧急', color: '#ef4444', description: '需要立即处理的回复' },
        { name: '咨询', color: '#3b82f6', description: '产品或服务咨询' },
        { name: '投诉', color: '#f59e0b', description: '客户投诉或问题反馈' },
        { name: '感谢', color: '#10b981', description: '客户感谢或好评' },
        { name: '退款', color: '#ef4444', description: '退款相关请求' },
        { name: '技术支持', color: '#8b5cf6', description: '技术问题支持' },
        { name: '合作', color: '#06b6d4', description: '商务合作相关' },
        { name: '已解决', color: '#6b7280', description: '问题已解决' },
        { name: '待跟进', color: '#f97316', description: '需要后续跟进' },
        { name: '重要客户', color: '#dc2626', description: '重要客户标记' }
      ]

      return NextResponse.json({
        success: true,
        data: { presetTags }
      })
    }

    return NextResponse.json(
      { error: '不支持的查询类型' },
      { status: 400 }
    )
  } catch (error) {
    console.error('获取标签信息失败:', error)
    return NextResponse.json(
      { error: '获取标签信息失败' },
      { status: 500 }
    )
  }
}

// 批量添加标签
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const body = await request.json()
    const { replyIds, tags } = addTagsSchema.parse(body)

    // 验证回复是否属于当前用户
    const replies = await prisma.emailReply.findMany({
      where: {
        id: { in: replyIds },
        userId: currentUser.id
      },
      select: {
        id: true,
        tags: true
      }
    })

    if (replies.length !== replyIds.length) {
      return NextResponse.json(
        { error: '部分回复不存在或无权限' },
        { status: 400 }
      )
    }

    // 为每个回复添加标签（去重）
    const updatePromises = replies.map(reply => {
      const existingTags = reply.tags || []
      const newTags = Array.from(new Set([...existingTags, ...tags]))
      
      return prisma.emailReply.update({
        where: { id: reply.id },
        data: {
          tags: newTags,
          updatedAt: new Date()
        }
      })
    })

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      message: `成功为 ${replyIds.length} 个回复添加标签`
    })
  } catch (error) {
    console.error('添加标签失败:', error)
    return NextResponse.json(
      { error: '添加标签失败' },
      { status: 500 }
    )
  }
}

// 批量移除标签
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const body = await request.json()
    const { replyIds, tags } = removeTagsSchema.parse(body)

    // 验证回复是否属于当前用户
    const replies = await prisma.emailReply.findMany({
      where: {
        id: { in: replyIds },
        userId: currentUser.id
      },
      select: {
        id: true,
        tags: true
      }
    })

    if (replies.length !== replyIds.length) {
      return NextResponse.json(
        { error: '部分回复不存在或无权限' },
        { status: 400 }
      )
    }

    // 为每个回复移除指定标签
    const updatePromises = replies.map(reply => {
      const existingTags = reply.tags || []
      const newTags = existingTags.filter(tag => !tags.includes(tag))
      
      return prisma.emailReply.update({
        where: { id: reply.id },
        data: {
          tags: newTags,
          updatedAt: new Date()
        }
      })
    })

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      message: `成功从 ${replyIds.length} 个回复中移除标签`
    })
  } catch (error) {
    console.error('移除标签失败:', error)
    return NextResponse.json(
      { error: '移除标签失败' },
      { status: 500 }
    )
  }
}

// 更新标签（重命名、合并等操作）
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const body = await request.json()
    const { action, oldTag, newTag } = body

    if (action === 'rename') {
      if (!oldTag || !newTag) {
        return NextResponse.json(
          { error: '缺少必要参数' },
          { status: 400 }
        )
      }

      // 获取所有包含旧标签的回复
      const replies = await prisma.emailReply.findMany({
        where: {
          userId: currentUser.id,
          tags: {
            has: oldTag
          }
        },
        select: {
          id: true,
          tags: true
        }
      })

      // 批量更新标签
      const updatePromises = replies.map(reply => {
        const newTags = reply.tags.map(tag => tag === oldTag ? newTag : tag)
        
        return prisma.emailReply.update({
          where: { id: reply.id },
          data: {
            tags: newTags,
            updatedAt: new Date()
          }
        })
      })

      await Promise.all(updatePromises)

      return NextResponse.json({
        success: true,
        message: `成功将标签 "${oldTag}" 重命名为 "${newTag}"，影响 ${replies.length} 个回复`
      })
    }

    if (action === 'merge') {
      const { sourceTags, targetTag } = body
      
      if (!sourceTags || !Array.isArray(sourceTags) || !targetTag) {
        return NextResponse.json(
          { error: '缺少必要参数' },
          { status: 400 }
        )
      }

      // 获取所有包含源标签的回复
      const replies = await prisma.emailReply.findMany({
        where: {
          userId: currentUser.id,
          tags: {
            hasSome: sourceTags
          }
        },
        select: {
          id: true,
          tags: true
        }
      })

      // 批量合并标签
      const updatePromises = replies.map(reply => {
        let newTags = reply.tags.filter(tag => !sourceTags.includes(tag))
        if (!newTags.includes(targetTag)) {
          newTags.push(targetTag)
        }
        
        return prisma.emailReply.update({
          where: { id: reply.id },
          data: {
            tags: newTags,
            updatedAt: new Date()
          }
        })
      })

      await Promise.all(updatePromises)

      return NextResponse.json({
        success: true,
        message: `成功将标签 [${sourceTags.join(', ')}] 合并为 "${targetTag}"，影响 ${replies.length} 个回复`
      })
    }

    return NextResponse.json(
      { error: '不支持的操作' },
      { status: 400 }
    )
  } catch (error) {
    console.error('更新标签失败:', error)
    return NextResponse.json(
      { error: '更新标签失败' },
      { status: 500 }
    )
  }
}