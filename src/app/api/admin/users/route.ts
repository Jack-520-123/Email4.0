import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyUserApprovalResult } from '@/lib/notifications'

// 获取所有用户列表（仅管理员）
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

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        permissions: true,
        createdAt: true,
        _count: {
          select: {
            emailProfiles: true,
            templates: true,
            campaigns: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('获取用户列表失败:', error)
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    )
  }
}

// 更新用户权限（仅管理员）
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

    const { userId, permissions, role, status } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 })
    }

    // 构建更新数据
    const updateData: any = {}
    if (role !== undefined) updateData.role = role
    
    // 处理权限更新
    if (permissions !== undefined) {
      updateData.permissions = permissions
    }
    
    // 处理状态更新
    if (status !== undefined) {
      updateData.status = status
      
      // 如果审核通过，强制设置默认权限，不管用户之前是否有权限
      if (status === 'approved') {
        // 设置默认权限
        updateData.permissions = {
          emailTypes: ['qq', '163', 'gmail', 'outlook', 'hotmail', 'yahoo', 'sina', 'sohu', '126', 'foxmail', 'aliyun', 'work.weixin', 'exmail.qq'],
          maxCampaigns: 10,
          canManageUsers: false,
          canManageSystem: false
        }
        
        console.log('用户审核通过，强制设置默认权限:', JSON.stringify(updateData.permissions))
      }
    }

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        permissions: true
      }
    })

    // 如果更新了用户状态（审批结果），发送通知给用户
    if (status !== undefined && (status === 'approved' || status === 'rejected')) {
      try {
        await notifyUserApprovalResult({
          userId: updatedUser.id,
          userEmail: updatedUser.email!,
          userName: updatedUser.name || undefined,
          approved: status === 'approved'
        })
      } catch (notificationError) {
        console.error('发送审批结果通知失败:', notificationError)
        // 不影响主要流程，只记录错误
      }
    }

    return NextResponse.json({ 
      success: true, 
      user: updatedUser,
      message: '用户权限更新成功' 
    })
  } catch (error) {
    console.error('更新用户权限失败:', error)
    return NextResponse.json(
      { error: '更新用户权限失败' },
      { status: 500 }
    )
  }
}