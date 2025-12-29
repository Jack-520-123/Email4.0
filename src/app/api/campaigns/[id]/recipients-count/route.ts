import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
    }

    const campaignId = params.id

    // 获取当前用户
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }

    // 获取活动信息
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: currentUser.id
      }
    })

    if (!campaign) {
      return NextResponse.json({ success: false, error: '活动不存在' }, { status: 404 })
    }

    let count = 0

    // 根据收件人来源计算数量
    if (campaign.recipientSource === 'recipientGroup') {
      let groupFilter = {}
      
      if (campaign.groupSelectionMode === 'specific' && campaign.selectedGroups) {
        const selectedGroups = Array.isArray(campaign.selectedGroups) 
          ? campaign.selectedGroups 
          : JSON.parse(campaign.selectedGroups as string || '[]')
        
        groupFilter = {
          group: {
            in: selectedGroups
          }
        }
      } else {
        groupFilter = {
          group: {
            not: null
          },
          AND: {
            group: {
              not: ''
            }
          }
        }
      }
      
      count = await prisma.recipient.count({
        where: {
          userId: currentUser.id,
          ...groupFilter
        }
      })
    } else if (campaign.recipientSource === 'excelUpload' && campaign.excelUploadId) {
      const excelUpload = await prisma.excelUpload.findFirst({
        where: { id: campaign.excelUploadId, userId: currentUser.id }
      })
      if (excelUpload && excelUpload.data) {
        count = Array.isArray(excelUpload.data) ? excelUpload.data.length : 0
      }
    } else if (campaign.recipientSource === 'recipientList' && campaign.recipientListId) {
      count = await prisma.recipient.count({
        where: {
          recipientListId: campaign.recipientListId,
          recipientList: {
            userId: currentUser.id
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      count
    })

  } catch (error) {
    console.error('获取收件人数量失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}