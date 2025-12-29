import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'
import * as XLSX from 'xlsx'
import nodemailer from 'nodemailer'
import { TaskRecoveryService } from '@/lib/task-recovery'

// 修复datetime-local时区问题的辅助函数
function parseScheduledAt(scheduledAtInput: string | null | undefined): Date | null {
  if (!scheduledAtInput) {
    return null
  }
  
  // 如果输入是datetime-local格式（如：2025-06-21T10:00）
  // 需要将其视为本地时间，而不是UTC时间
  let scheduledDate
  
  if (typeof scheduledAtInput === 'string') {
    // 检查是否是datetime-local格式（没有时区信息）
    if (scheduledAtInput.match(/^d{4}-d{2}-d{2}Td{2}:d{2}(:d{2})?$/)) {
      // 这是datetime-local格式，需要特殊处理
      // 添加秒数（如果没有）
      const timeWithSeconds = scheduledAtInput.includes(':') && scheduledAtInput.split(':').length === 2 
        ? scheduledAtInput + ':00' 
        : scheduledAtInput
      
      // 创建Date对象（会被解释为本地时间）
      scheduledDate = new Date(timeWithSeconds)
      
      console.log('解析datetime-local输入:', {
        原始输入: scheduledAtInput,
        处理后: timeWithSeconds,
        解析结果: scheduledDate,
        本地时间字符串: scheduledDate.toLocaleString(),
        UTC时间字符串: scheduledDate.toISOString()
      })
    } else {
      // 其他格式，直接解析
      scheduledDate = new Date(scheduledAtInput)
    }
  } else {
    scheduledDate = new Date(scheduledAtInput)
  }
  
  // 验证日期是否有效
  if (isNaN(scheduledDate.getTime())) {
    throw new Error('无效的定时时间格式')
  }
  
  return scheduledDate
}

// 创建发送活动
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }
    const { 
      name, 
      templateId, 
      emailProfileId, 
      scheduledAt,
      sendImmediately,
      recipientSource,
      recipientListId,
      excelUploadId,
      selectedGroups,
      groupSelectionMode,
  
      enableRandomInterval,
      randomIntervalMin,
      randomIntervalMax,
      enableTimeLimit,
      sendStartTime,
      sendEndTime
    } = await request.json()

    console.log('接收到的参数:', { scheduledAt, sendImmediately })

    if (!name || !templateId || !emailProfileId) {
      return NextResponse.json({ 
        error: '请填写活动名称、选择模板和发件人' 
      }, { status: 400 })
    }
    
    if (!recipientSource || 
        (recipientSource === 'recipientList' && !recipientListId) || 
        (recipientSource === 'excelUpload' && !excelUploadId) ||
        (recipientSource === 'recipientGroup' && groupSelectionMode === 'specific' && (!selectedGroups || selectedGroups.length === 0))) {
      return NextResponse.json({ 
        error: '请选择收件人数据源' 
      }, { status: 400 })
    }

    // 验证模板和邮件配置是否属于当前用户
    const template = await prisma.template.findFirst({
      where: { id: templateId, userId: currentUser.id }
    })
    
    const emailProfile = await prisma.emailProfile.findFirst({
      where: { id: emailProfileId, userId: currentUser.id }
    })

    if (!template || !emailProfile) {
      return NextResponse.json({ 
        error: '模板或发件人配置不存在' 
      }, { status: 400 })
    }

    let totalRecipients = 0
    
    // 根据数据源类型计算收件人数量
    if (recipientSource === 'excelUpload' && excelUploadId) {
      const excelUpload = await prisma.excelUpload.findFirst({
        where: { id: excelUploadId, userId: currentUser.id }
      })
      
      if (!excelUpload) {
        return NextResponse.json({ 
          error: 'Excel文件不存在' 
        }, { status: 400 })
      }
      
      totalRecipients = excelUpload.totalRecords
    } else if (recipientSource === 'recipientList' && recipientListId) {
      const recipientList = await prisma.recipientList.findFirst({
        where: { id: recipientListId, userId: currentUser.id },
        include: {
          _count: {
            select: { recipients: true }
          }
        }
      })
      
      if (!recipientList) {
        return NextResponse.json({ 
          error: '收件人列表不存在' 
        }, { status: 400 })
      }
      
      totalRecipients = recipientList._count.recipients
    } else if (recipientSource === 'recipientGroup') {
      // 计算分组收件人数量
      let groupFilter = {}
      
      if (groupSelectionMode === 'specific' && selectedGroups && selectedGroups.length > 0) {
        groupFilter = {
          group: {
            in: selectedGroups
          }
        }
      } else {
        // 所有分组模式，排除没有分组的收件人
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
      
      const groupRecipientCount = await prisma.recipient.count({
        where: {
          userId: currentUser.id,
          ...groupFilter
        }
      })
      
      totalRecipients = groupRecipientCount
    }

    // 使用修复后的时间解析函数
    let parsedScheduledAt
    try {
      parsedScheduledAt = parseScheduledAt(scheduledAt)
      console.log('解析后的定时时间:', parsedScheduledAt)
    } catch (error) {
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : '解析时间失败'
      }, { status: 400 })
    }

    if (!sendImmediately) {
      if (!parsedScheduledAt) {
        return NextResponse.json({ error: '定时发送需要设置发送时间' }, { status: 400 })
      }
      if (parsedScheduledAt < new Date()) {
        return NextResponse.json({ error: '定时发送时间必须在未来' }, { status: 400 })
      }
    }

    // 创建活动
    const campaign = await prisma.campaign.create({
      data: {
        userId: currentUser.id,
        name,
        templateId,
        emailProfileId,
        excelUploadId: recipientSource === 'excelUpload' ? excelUploadId : undefined,
        recipientListId: recipientSource === 'recipientList' ? recipientListId : undefined,
        recipientSource,
        // 确保 selectedGroups 作为 JSON 存储
        selectedGroups: recipientSource === 'recipientGroup' ? JSON.stringify(selectedGroups || []) : undefined,
        groupSelectionMode: recipientSource === 'recipientGroup' ? (groupSelectionMode || 'all') : undefined,
        totalRecipients,
        scheduledAt: sendImmediately ? new Date() : parsedScheduledAt,
        
        enableRandomInterval: enableRandomInterval || false,
        randomIntervalMin: randomIntervalMin ? parseInt(randomIntervalMin.toString()) : 60,
        randomIntervalMax: randomIntervalMax ? parseInt(randomIntervalMax.toString()) : 120,
        enableTimeLimit: enableTimeLimit || false,
        sendStartTime: sendStartTime || undefined,
        sendEndTime: sendEndTime || undefined,
        isPaused: false,
        status: CampaignStatus.DRAFT,
        // 设置初始值
        lastProcessedIndex: 0,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        failedCount: 0,
        isStopped: false,
        isArchived: false
      },
      include: {
        template: true,
        emailProfile: true,
        excelUpload: true,
        recipientList: true
      }
    })

    console.log('创建的活动:', {
      id: campaign.id,
      name: campaign.name,
      sendImmediately: sendImmediately,
      scheduledAt: campaign.scheduledAt,
      scheduledAtLocal: campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : null
    })

    console.log('活动创建成功，状态为DRAFT，等待用户手动启动')

    return NextResponse.json({ 
      success: true, 
      campaign 
    })

  } catch (error) {
    console.error('创建活动错误:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ 
      error: '创建活动失败',
      details: errorMessage
    }, { status: 500 })
  }
}

// 获取活动列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')

    const where: any = {
      userId: currentUser.id
    }

    if (status) {
      where.status = status
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              subject: true
            }
          },
          emailProfile: {
            select: {
              id: true,
              nickname: true,
              email: true
            }
          },
          excelUpload: {
            select: {
              id: true,
              originalName: true,
              totalRecords: true
            }
          },
          recipientList: {
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  recipients: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.campaign.count({ where })
    ])

    // 为每个活动添加isRunning状态和isPaused字段
    const campaignsWithRunningStatus = await Promise.all(
      campaigns.map(async (campaign) => {
        // 只有状态为SENDING的活动才需要检查队列运行状态
        // 已完成、已停止、失败的活动不应该显示为运行中
        let isRunning = false
        if (campaign.status === CampaignStatus.SENDING) {
          const taskCount = await TaskRecoveryService.getInstance().getCampaignTaskCount(campaign.id)
          isRunning = taskCount > 0
        }
        return {
          ...campaign,
          isRunning,
          isPaused: campaign.isPaused || false // 确保isPaused字段被返回
        }
      })
    )

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithRunningStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('获取活动列表错误:', error)
    return NextResponse.json({ 
      error: '获取活动列表失败' 
    }, { status: 500 })
  }
}
