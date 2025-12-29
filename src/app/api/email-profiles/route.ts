import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// 获取用户的邮箱配置列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const profiles = await prisma.emailProfile.findMany({
      where: {
        userId: currentUser.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        nickname: true,
        email: true,
        smtpServer: true,
        smtpPort: true,
        sendInterval: true,
        randomInterval: true,
        maxEmailsPerHour: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({ profiles })
  } catch (error) {
    console.error('获取邮箱配置失败:', error)
    return NextResponse.json(
      { error: '获取邮箱配置失败' },
      { status: 500 }
    )
  }
}

// 创建新的邮箱配置
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const { name, email, password, smtpServer, smtpPort, smtpSecure, sendInterval, randomInterval, maxEmailsPerHour } = await request.json()

    // 验证必需字段
    if (!name || !email || !smtpServer || !smtpPort) {
      return NextResponse.json(
        { error: '请填写所有必需字段' },
        { status: 400 }
      )
    }

    // 检查邮箱是否已存在
    const existingProfile = await prisma.emailProfile.findFirst({
      where: {
        email,
        userId: currentUser.id
      }
    })

    if (existingProfile) {
      return NextResponse.json(
        { error: '该邮箱配置已存在' },
        { status: 400 }
      )
    }

    const profile = await prisma.emailProfile.create({
      data: {
        nickname: name,
        email,
        password,
        smtpServer,
        smtpPort: parseInt(smtpPort),
        sendInterval: sendInterval || 5,
        randomInterval: randomInterval || 3,
        maxEmailsPerHour: maxEmailsPerHour || 100,
        userId: currentUser.id
      }
    })

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    console.error('创建邮箱配置失败:', error)
    return NextResponse.json(
      { error: '创建邮箱配置失败' },
      { status: 500 }
    )
  }
}

// 删除邮箱配置
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少邮箱配置ID' },
        { status: 400 }
      )
    }

    await prisma.emailProfile.delete({
      where: {
        id,
        userId: currentUser.id
      }
    })

    return NextResponse.json({ message: '删除成功' })
  } catch (error) {
    console.error('删除邮箱配置失败:', error)
    return NextResponse.json(
      { error: '删除邮箱配置失败' },
      { status: 500 }
    )
  }
}