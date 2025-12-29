import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { UserProfileService } from '@/lib/user-profile'

// 获取用户画像列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') as 'engagementScore' | 'lastActivityAt' | 'createdAt' || 'engagementScore'
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc'
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []

    const result = await UserProfileService.getUserProfiles(session.user.id, {
      page,
      limit,
      sortBy,
      sortOrder,
      tags: tags.length > 0 ? tags : undefined
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('获取用户画像失败:', error)
    return NextResponse.json(
      { error: '获取用户画像失败' },
      { status: 500 }
    )
  }
}

// 创建或更新用户画像
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { recipientEmail, recipientName, company, position, industry, location, tags } = body

    if (!recipientEmail) {
      return NextResponse.json(
        { error: '收件人邮箱是必需的' },
        { status: 400 }
      )
    }

    const profile = await UserProfileService.createOrUpdateProfile(
      session.user.id,
      {
        recipientEmail,
        recipientName,
        company,
        position,
        industry,
        location,
        tags
      }
    )

    return NextResponse.json(profile)
  } catch (error) {
    console.error('创建/更新用户画像失败:', error)
    return NextResponse.json(
      { error: '创建/更新用户画像失败' },
      { status: 500 }
    )
  }
}