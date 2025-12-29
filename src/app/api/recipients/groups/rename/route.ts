import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { oldName, newName } = await request.json()

    if (!oldName || !newName) {
      return NextResponse.json(
        { error: '分组名称不能为空' },
        { status: 400 }
      )
    }

    if (oldName === newName) {
      return NextResponse.json(
        { error: '新分组名称与原名称相同' },
        { status: 400 }
      )
    }

    // 检查新分组名称是否已存在
    const existingGroup = await prisma.recipient.findFirst({
      where: {
        user: {
          email: session.user.email
        },
        group: newName
      }
    })

    if (existingGroup) {
      return NextResponse.json(
        { error: '新分组名称已存在' },
        { status: 400 }
      )
    }

    // 更新所有该分组下的收件人
    const result = await prisma.recipient.updateMany({
      where: {
        user: {
          email: session.user.email
        },
        group: oldName
      },
      data: {
        group: newName
      }
    })

    return NextResponse.json({
      message: `成功重命名分组，共更新 ${result.count} 个收件人`,
      updatedCount: result.count
    })
  } catch (error) {
    console.error('重命名分组失败:', error)
    return NextResponse.json(
      { error: '重命名分组失败' },
      { status: 500 }
    )
  }
}