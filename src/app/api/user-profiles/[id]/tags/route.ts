import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { UserProfileService } from '@/lib/user-profile'
import { prisma } from '@/lib/prisma'

// 添加标签
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { tags } = await request.json()
    if (!Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: '标签数组是必需的' },
        { status: 400 }
      )
    }

    // 验证用户画像是否属于当前用户
    const profile = await prisma.userProfile.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!profile) {
      return NextResponse.json(
        { error: '用户画像不存在或无权限' },
        { status: 404 }
      )
    }

    const updatedProfile = await UserProfileService.addTags(params.id, tags)

    return NextResponse.json({
      success: true,
      data: updatedProfile
    })
  } catch (error) {
    console.error('添加标签失败:', error)
    return NextResponse.json(
      { error: '添加标签失败' },
      { status: 500 }
    )
  }
}

// 移除标签
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { tags } = await request.json()
    if (!Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: '标签数组是必需的' },
        { status: 400 }
      )
    }

    // 验证用户画像是否属于当前用户
    const profile = await prisma.userProfile.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!profile) {
      return NextResponse.json(
        { error: '用户画像不存在或无权限' },
        { status: 404 }
      )
    }

    const updatedProfile = await UserProfileService.removeTags(params.id, tags)

    return NextResponse.json({
      success: true,
      data: updatedProfile
    })
  } catch (error) {
    console.error('移除标签失败:', error)
    return NextResponse.json(
      { error: '移除标签失败' },
      { status: 500 }
    )
  }
}