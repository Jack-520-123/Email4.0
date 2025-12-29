import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 批量删除收件人
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '收件人ID列表是必需的' },
        { status: 400 }
      )
    }

    // 检查所有收件人是否存在且属于当前用户
    const existingRecipients = await prisma.recipient.findMany({
      where: { 
        id: { in: ids },
        userId: currentUser.id // 确保只能删除自己的收件人
      },
      select: { id: true }
    })

    const existingIds = existingRecipients.map(r => r.id)
    const notFoundIds = ids.filter(id => !existingIds.includes(id))

    if (notFoundIds.length > 0) {
      return NextResponse.json(
        { 
          error: `以下收件人不存在或无权限删除: ${notFoundIds.join(', ')}` 
        },
        { status: 404 }
      )
    }

    // 批量删除收件人
    const deleteResult = await prisma.recipient.deleteMany({
      where: {
        id: { in: existingIds },
        userId: currentUser.id // 双重保险，确保只删除自己的收件人
      }
    })

    return NextResponse.json(
      { 
        message: `成功删除 ${deleteResult.count} 个收件人`,
        deletedCount: deleteResult.count
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('批量删除收件人失败:', error)
    return NextResponse.json(
      { 
        error: '批量删除收件人失败', 
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}