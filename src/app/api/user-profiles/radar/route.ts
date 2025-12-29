import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { UserProfileService } from '@/lib/user-profile'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 获取用户画像雷达图数据
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const radarData = await UserProfileService.getRadarChartData(session.user.id)

    return NextResponse.json({
      success: true,
      data: radarData
    })
  } catch (error) {
    console.error('获取雷达图数据失败:', error)
    return NextResponse.json(
      { error: '获取雷达图数据失败' },
      { status: 500 }
    )
  }
}