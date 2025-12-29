import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'

// 更新暂停状态的活动内容
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const currentUser = session.user as { id: string; role?: string }
    const campaignId = params.id
    const updateData = await request.json()

    // 获取当前活动状态
    // 管理员可以访问所有活动，普通用户只能访问自己的活动
    const whereCondition: any = { id: campaignId }
    if (currentUser.role !== 'admin') {
      whereCondition.userId = currentUser.id
    }
    
    const campaign = await prisma.campaign.findFirst({
      where: whereCondition
    })

    if (!campaign) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 })
    }

    // 只允许修改草稿、暂停或停止状态的活动
    if (!['DRAFT', 'PAUSED', 'STOPPED'].includes(campaign.status)) {
      return NextResponse.json({ error: '只能修改草稿、暂停或停止状态的活动' }, { status: 400 })
    }

    // 准备更新数据
    const allowedFields = [
      'name',
      'templateId', 
      'emailProfileId',
      'excelUploadId',
      'recipientListId',
      'recipientSource',
      'groupSelectionMode',
      'selectedGroups',
      'sendImmediately',
      'scheduledAt',
      'randomIntervalMin',
      'randomIntervalMax',
      'enableRandomInterval',
      'sendStartTime',
      'sendEndTime',
      'enableTimeLimit'
    ]

    const filteredUpdateData: any = {}
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredUpdateData[field] = updateData[field]
      }
    }

    // 如果更改了收件人相关配置，重置发送计数
    const shouldResetStats = (
      updateData.excelUploadId !== undefined && updateData.excelUploadId !== campaign.excelUploadId
    ) || (
      updateData.recipientListId !== undefined && updateData.recipientListId !== campaign.recipientListId
    ) || (
      updateData.selectedGroups !== undefined && 
      JSON.stringify(updateData.selectedGroups) !== JSON.stringify(campaign.selectedGroups)
    ) || (
      updateData.recipientSource !== undefined && updateData.recipientSource !== campaign.recipientSource
    )

    if (shouldResetStats) {
      console.log(`[Campaign Update] 检测到收件人配置变化，重置发送统计 - 活动ID: ${campaignId}`)
      filteredUpdateData.sentCount = 0
      filteredUpdateData.deliveredCount = 0
      filteredUpdateData.openedCount = 0
      filteredUpdateData.clickedCount = 0
      filteredUpdateData.failedCount = 0
      filteredUpdateData.lastSentAt = null
      
      // 删除已发送的邮件记录
      await prisma.sentEmail.deleteMany({
        where: { campaignId: campaignId }
      })
      
      // 重新计算totalRecipients
      let totalRecipients = 0
      
      if (filteredUpdateData.recipientSource === 'excelUpload' && filteredUpdateData.excelUploadId) {
        // 从Excel上传获取收件人数量
        const excelUpload = await prisma.excelUpload.findUnique({
          where: { id: filteredUpdateData.excelUploadId },
          select: { totalRecords: true }
        })
        totalRecipients = excelUpload?.totalRecords || 0
      } else if (filteredUpdateData.recipientSource === 'recipientList' && filteredUpdateData.recipientListId) {
        // 从收件人列表获取收件人数量
        if (filteredUpdateData.selectedGroups && filteredUpdateData.selectedGroups.length > 0) {
          // 如果选择了特定分组，只计算这些分组的收件人
          totalRecipients = await prisma.recipient.count({
            where: {
              recipientListId: filteredUpdateData.recipientListId,
              group: { in: filteredUpdateData.selectedGroups }
            }
          })
        } else {
          // 如果没有选择分组，计算所有收件人
          totalRecipients = await prisma.recipient.count({
            where: {
              recipientListId: filteredUpdateData.recipientListId
            }
          })
        }
      } else if (filteredUpdateData.recipientSource === 'recipientGroup' && filteredUpdateData.selectedGroups) {
        // 从收件人群组获取收件人数量
        let selectedGroups = filteredUpdateData.selectedGroups
        if (typeof selectedGroups === 'string') {
          try {
            selectedGroups = JSON.parse(selectedGroups)
          } catch (e) {
            selectedGroups = [selectedGroups]
          }
        }
        
        if (Array.isArray(selectedGroups) && selectedGroups.length > 0) {
          totalRecipients = await prisma.recipient.count({
            where: {
              userId: campaign.userId,
              group: { in: selectedGroups }
            }
          })
        }
      }
      
      filteredUpdateData.totalRecipients = totalRecipients
      console.log(`[Campaign Update] 更新totalRecipients为: ${totalRecipients}`)
    } else {
      // 即使没有重置统计，也要检查是否需要更新totalRecipients
      // 这处理了收件人数据源本身发生变化的情况
      let shouldUpdateTotal = false
      let totalRecipients = 0
      
      const currentRecipientSource = filteredUpdateData.recipientSource || campaign.recipientSource
      const currentExcelUploadId = filteredUpdateData.excelUploadId !== undefined ? filteredUpdateData.excelUploadId : campaign.excelUploadId
      const currentRecipientListId = filteredUpdateData.recipientListId !== undefined ? filteredUpdateData.recipientListId : campaign.recipientListId
      const currentSelectedGroups = filteredUpdateData.selectedGroups !== undefined ? filteredUpdateData.selectedGroups : campaign.selectedGroups
      
      if (currentRecipientSource === 'excelUpload' && currentExcelUploadId) {
        const excelUpload = await prisma.excelUpload.findUnique({
          where: { id: currentExcelUploadId },
          select: { totalRecords: true }
        })
        totalRecipients = excelUpload?.totalRecords || 0
        shouldUpdateTotal = totalRecipients !== campaign.totalRecipients
      } else if (currentRecipientSource === 'recipientList' && currentRecipientListId) {
        if (currentSelectedGroups && currentSelectedGroups.length > 0) {
          totalRecipients = await prisma.recipient.count({
            where: {
              recipientListId: currentRecipientListId,
              group: { in: currentSelectedGroups }
            }
          })
        } else {
          totalRecipients = await prisma.recipient.count({
            where: {
              recipientListId: currentRecipientListId
            }
          })
        }
        shouldUpdateTotal = totalRecipients !== campaign.totalRecipients
      } else if (currentRecipientSource === 'recipientGroup' && currentSelectedGroups) {
        // 从收件人群组获取收件人数量
        let selectedGroups = currentSelectedGroups
        if (typeof selectedGroups === 'string') {
          try {
            selectedGroups = JSON.parse(selectedGroups)
          } catch (e) {
            selectedGroups = [selectedGroups]
          }
        }
        
        if (Array.isArray(selectedGroups) && selectedGroups.length > 0) {
          totalRecipients = await prisma.recipient.count({
            where: {
              userId: campaign.userId,
              group: { in: selectedGroups }
            }
          })
        }
        shouldUpdateTotal = totalRecipients !== campaign.totalRecipients
      }
      
      if (shouldUpdateTotal) {
        filteredUpdateData.totalRecipients = totalRecipients
        console.log(`[Campaign Update] 更新totalRecipients为: ${totalRecipients} (数据源变化)`)
      }
    }

    // 更新活动
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...filteredUpdateData,
        updatedAt: new Date()
      },
      include: {
        template: true,
        emailProfile: true,
        excelUpload: true,
        recipientList: {
          include: {
            recipients: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: '活动更新成功',
      campaign: updatedCampaign
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('更新活动失败:', errorMessage, errorStack)
    return NextResponse.json({ error: '更新活动失败: ' + errorMessage }, { status: 500 })
  }
}