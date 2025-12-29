import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { groupName } = await request.json()

    if (!groupName) {
      return NextResponse.json(
        { error: '分组名称不能为空' },
        { status: 400 }
      )
    }

    // 检查分组是否为空
    const recipientCount = await prisma.recipient.count({
      where: {
        user: {
          email: session.user.email
        },
        group: groupName
      }
    })

    if (recipientCount > 0) {
      return NextResponse.json(
        { error: '只能删除空分组，该分组还有收件人' },
        { status: 400 }
      )
    }

    // 由于分组是通过收件人的group字段维护的，空分组实际上不需要删除任何数据
    // 这里我们只是确认分组为空，然后返回成功消息
    return NextResponse.json({
      message: `空分组 "${groupName}" 已删除`
    })
  } catch (error) {
    console.error('删除空分组失败:', error)
    return NextResponse.json(
      { error: '删除空分组失败' },
      { status: 500 }
    )
  }
}