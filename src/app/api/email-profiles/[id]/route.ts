import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

// GET /api/email-profiles/[id] - 获取单个邮箱配置
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const profile = await prisma.emailProfile.findFirst({
      where: {
        id: params.id,
        userId: currentUser.id,
      },
      select: {
        id: true,
        nickname: true,
        email: true,
        smtpServer: true,
        smtpPort: true,
        // smtpSecure字段不存在于数据库模型中
        sendInterval: true,     // 新增发送间隔
        randomInterval: true,   // 新增随机间隔
        maxEmailsPerHour: true, // 新增每小时最大发送数
        createdAt: true,
        updatedAt: true,
        // 不返回密码
      },
    })

    if (!profile) {
      return NextResponse.json({ error: '邮箱配置不存在' }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('获取邮箱配置失败:', error)
    return NextResponse.json(
      { error: '获取邮箱配置失败' },
      { status: 500 }
    )
  }
}

// PUT /api/email-profiles/[id] - 更新邮箱配置
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const { name, email, password, smtpServer, smtpPort, smtpSecure, sendInterval, randomInterval, maxEmailsPerHour } = await request.json() // 新增发送频次字段

    // 验证必需字段
    if (!name || !email || !smtpServer || !smtpPort) {
      return NextResponse.json(
        { error: '请填写所有必需字段' },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      )
    }

    // 检查邮箱配置是否存在且属于当前用户
    const existingProfile = await prisma.emailProfile.findFirst({
      where: {
        id: params.id,
        userId: currentUser.id,
      },
    })

    if (!existingProfile) {
      return NextResponse.json({ error: '邮箱配置不存在' }, { status: 404 })
    }

    // 检查邮箱是否与其他配置重复
    const duplicateProfile = await prisma.emailProfile.findFirst({
      where: {
        email,
        userId: currentUser.id,
        id: {
          not: params.id,
        },
      },
    })

    if (duplicateProfile) {
      return NextResponse.json(
        { error: '该邮箱已被其他配置使用' },
        { status: 400 }
      )
    }

    // 准备更新数据
    const updateData: any = {
      name,
      email,
      smtpServer,
      smtpPort: parseInt(smtpPort.toString()),
      // smtpSecure字段不存在于数据库模型中，通过端口号判断
    }

    // 添加发送频次字段（如果提供）
    if (sendInterval !== undefined) {
      updateData.sendInterval = parseInt(sendInterval.toString())
    }
    if (randomInterval !== undefined) {
      updateData.randomInterval = parseInt(randomInterval.toString())
    }
    if (maxEmailsPerHour !== undefined) {
      updateData.maxEmailsPerHour = parseInt(maxEmailsPerHour.toString())
    }

    // 如果提供了新密码，则更新
    if (password) {
      updateData.password = password
    }

    // 更新邮箱配置
    const updatedProfile = await prisma.emailProfile.update({
      where: {
        id: params.id,
      },
      data: updateData,
      select: {
        id: true,
        nickname: true,
        email: true,
        smtpServer: true,
        smtpPort: true,
        // smtpSecure字段不存在于数据库模型中
        sendInterval: true,     // 新增发送间隔
        randomInterval: true,   // 新增随机间隔
        maxEmailsPerHour: true, // 新增每小时最大发送数
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ profile: updatedProfile })
  } catch (error) {
    console.error('更新邮箱配置失败:', error)
    return NextResponse.json(
      { error: '更新邮箱配置失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/email-profiles/[id] - 删除邮箱配置
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    // 检查邮箱配置是否存在且属于当前用户
    const existingProfile = await prisma.emailProfile.findFirst({
      where: {
        id: params.id,
        userId: currentUser.id,
      },
    })

    if (!existingProfile) {
      return NextResponse.json({ error: '邮箱配置不存在' }, { status: 404 })
    }

    // 删除邮箱配置
    await prisma.emailProfile.delete({
      where: {
        id: params.id,
      },
    })

    return NextResponse.json({ message: '邮箱配置删除成功' })
  } catch (error) {
    console.error('删除邮箱配置失败:', error)
    return NextResponse.json(
      { error: '删除邮箱配置失败' },
      { status: 500 }
    )
  }
}