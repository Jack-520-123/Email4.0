import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserProfileService } from '@/lib/user-profile'
import { InteractionType } from '@prisma/client'

// 强制动态渲染
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('emailId')
    const type = searchParams.get('type') // 修复参数名称
    const url = searchParams.get('url')

    const userAgent = request.headers.get('user-agent') || ''
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'

    if (!emailId) {
      return new NextResponse('Missing emailId', { status: 400 })
    }

    // 查找发送的邮件记录
    const sentEmail = await prisma.sentEmail.findUnique({
      where: { id: emailId }
    })

    if (!sentEmail) {
      return new NextResponse('Email not found', { status: 404 })
    }

    // 解析设备类型
    function parseDeviceType(userAgent: string): string {
      if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
        return 'mobile'
      } else if (/Tablet/.test(userAgent)) {
        return 'tablet'
      }
      return 'desktop'
    }

    // 解析位置信息（简单实现）
    function parseLocation(ip: string): string {
      // 这里可以集成IP地理位置服务
      return 'unknown'
    }

    if (type === 'open') {
      // 更新邮件打开状态（只有首次打开才更新）
      const updateResult = await prisma.sentEmail.updateMany({
        where: {
          id: emailId,
          openedAt: null // 只在首次打开时更新
        },
        data: {
          status: 'opened',
          openedAt: new Date()
        }
      })

      // 只有首次打开时才更新Campaign统计
      if (updateResult.count > 0) {
        await prisma.campaign.update({
          where: { id: sentEmail.campaignId },
          data: { openedCount: { increment: 1 } }
        })
        console.log(`[Tracking] 邮件 ${emailId} 首次打开，更新活动统计`)
      }

      // 记录用户画像交互
      try {
        await UserProfileService.recordInteraction(
          sentEmail.recipientEmail,
          {
            type: InteractionType.EMAIL_OPENED,
            sentEmailId: emailId,
            details: {
              timestamp: new Date(),
              campaignId: sentEmail.campaignId
            },
            userAgent,
            ipAddress,
            deviceType: parseDeviceType(userAgent),
            location: parseLocation(ipAddress)
          }
        )
      } catch (profileError) {
        console.error('Record user profile interaction failed:', profileError)
        // Do not affect main functionality, continue execution
      }

      // 返回1x1像素的透明图片
      const pixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      )

      return new NextResponse(pixel, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    if (type === 'click' && url) {
      // 更新邮件点击状态（只有首次点击才更新）
      const clickUpdateResult = await prisma.sentEmail.updateMany({
        where: {
          id: emailId,
          clickedAt: null // 只在首次点击时更新
        },
        data: {
          status: 'clicked',
          clickedAt: new Date()
        }
      })

      // 只有首次点击时才更新Campaign统计
      if (clickUpdateResult.count > 0) {
        await prisma.campaign.update({
          where: { id: sentEmail.campaignId },
          data: { clickedCount: { increment: 1 } }
        })
        console.log(`[Tracking] 邮件 ${emailId} 首次点击，更新活动统计`)
      }

      // 记录用户画像交互
      try {
        await UserProfileService.recordInteraction(
          sentEmail.recipientEmail,
          {
            type: InteractionType.EMAIL_CLICKED,
            sentEmailId: emailId,
            details: {
              timestamp: new Date(),
              campaignId: sentEmail.campaignId,
              clickedUrl: url
            },
            userAgent,
            ipAddress,
            deviceType: parseDeviceType(userAgent),
            location: parseLocation(ipAddress)
          }
        )
      } catch (profileError) {
        console.error('Record user profile interaction failed:', profileError)
        // Do not affect main functionality, continue execution
      }

      // 重定向到目标URL
      if (url) {
        let targetUrl = decodeURIComponent(url)

        // 确保URL包含协议前缀
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = 'https://' + targetUrl
        }

        console.log(`[Tracking] 重定向到: ${targetUrl}`)
        return NextResponse.redirect(targetUrl)
      }
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('Tracking error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
