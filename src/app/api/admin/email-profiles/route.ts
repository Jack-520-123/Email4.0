import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// 强制动态渲染，防止构建时尝试连接数据库
export const dynamic = 'force-dynamic'
export const revalidate = 0

// 获取系统管理员邮箱配置
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查是否为管理员
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const adminProfiles = await prisma.emailProfile.findMany({
      where: {
        isSystemAdmin: true
      },
      select: {
        id: true,
        nickname: true,
        email: true,
        emailType: true,
        smtpServer: true,
        smtpPort: true,
        isDefault: true,
        isSystemAdmin: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ profiles: adminProfiles })
  } catch (error) {
    console.error('获取系统管理员邮箱配置失败:', error)
    return NextResponse.json(
      { error: '获取邮箱配置失败' },
      { status: 500 }
    )
  }
}

// 创建系统管理员邮箱配置
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查是否为管理员
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { nickname, email, password, emailType, smtpServer, smtpPort, isDefault } = await request.json()

    if (!nickname || !email || !password || !emailType || !smtpServer || !smtpPort) {
      return NextResponse.json({ error: '所有字段都是必填的' }, { status: 400 })
    }

    // 如果设置为默认，先取消其他默认配置
    if (isDefault) {
      await prisma.emailProfile.updateMany({
        where: {
          isSystemAdmin: true,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      })
    }

    const profile = await prisma.emailProfile.create({
      data: {
        nickname,
        email,
        password: password,
        emailType,
        smtpServer,
        smtpPort: parseInt(smtpPort),
        isDefault: isDefault || false,
        isSystemAdmin: true,
        userId: currentUser.id
      },
      select: {
        id: true,
        nickname: true,
        email: true,
        emailType: true,
        smtpServer: true,
        smtpPort: true,
        isDefault: true,
        isSystemAdmin: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      success: true,
      profile,
      message: '系统管理员邮箱配置创建成功'
    })
  } catch (error) {
    console.error('创建系统管理员邮箱配置失败:', error)
    return NextResponse.json(
      { error: '创建邮箱配置失败' },
      { status: 500 }
    )
  }
}

// 更新系统管理员邮箱配置
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查是否为管理员
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { id, nickname, email, password, emailType, smtpServer, smtpPort, isDefault } = await request.json()

    if (!id) {
      return NextResponse.json({ error: '配置ID不能为空' }, { status: 400 })
    }

    // 如果设置为默认，先取消其他默认配置
    if (isDefault) {
      await prisma.emailProfile.updateMany({
        where: {
          isSystemAdmin: true,
          isDefault: true,
          id: { not: id }
        },
        data: {
          isDefault: false
        }
      })
    }

    const updateData: any = {
      nickname,
      email,
      emailType,
      smtpServer,
      smtpPort: smtpPort ? parseInt(smtpPort) : undefined,
      isDefault: isDefault || false
    }

    // 如果提供了新密码，则更新
    if (password) {
      updateData.password = password
    }

    const profile = await prisma.emailProfile.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nickname: true,
        email: true,
        emailType: true,
        smtpServer: true,
        smtpPort: true,
        isDefault: true,
        isSystemAdmin: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      success: true,
      profile,
      message: '系统管理员邮箱配置更新成功'
    })
  } catch (error) {
    console.error('更新系统管理员邮箱配置失败:', error)
    return NextResponse.json(
      { error: '更新邮箱配置失败' },
      { status: 500 }
    )
  }
}