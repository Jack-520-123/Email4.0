import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 按分组删除收件人
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    const body = await request.json()
    const { groupName } = body

    if (!groupName || typeof groupName !== 'string') {
      return NextResponse.json(
        { error: '分组名称不能为空' },
        { status: 400 }
      )
    }

    // 首先获取该分组下的所有收件人ID
    const recipientsToDelete = await prisma.recipient.findMany({
      where: {
        userId: currentUser.id,
        group: groupName
      },
      select: {
        id: true
      }
    })

    if (recipientsToDelete.length === 0) {
      return NextResponse.json(
        { error: '该分组下没有收件人' },
        { status: 404 }
      )
    }

    const recipientIds = recipientsToDelete.map(r => r.id)

    // 删除该分组下的所有收件人
    const deleteResult = await prisma.recipient.deleteMany({
      where: {
        id: {
          in: recipientIds
        },
        userId: currentUser.id
      }
    })

    return NextResponse.json({
      message: `成功删除分组 "${groupName}" 下的 ${deleteResult.count} 个收件人`,
      deletedCount: deleteResult.count
    })
  } catch (error) {
    console.error('按分组删除收件人失败:', error)
    return NextResponse.json(
      { error: '删除失败，请稍后重试' },
      { status: 500 }
    )
  }
}