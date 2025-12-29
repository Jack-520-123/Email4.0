import { prisma } from '@/lib/prisma'

// 通知类型枚举
export const NotificationTypes = {
  USER_REGISTRATION: 'user_registration',
  USER_APPROVAL_NEEDED: 'user_approval_needed',
  USER_APPROVED: 'user_approved',
  USER_REJECTED: 'user_rejected',
  CAMPAIGN_COMPLETED: 'campaign_completed',
  SYSTEM_ALERT: 'system_alert'
} as const

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes]

// 创建通知的通用函数
export async function createNotification({
  userId,
  type,
  title,
  message,
  data = null
}: {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: any
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data
      }
    })
    return notification
  } catch (error) {
    console.error('创建通知失败:', error)
    throw error
  }
}

// 为所有管理员创建通知
export async function createNotificationForAdmins({
  type,
  title,
  message,
  data = null
}: {
  type: NotificationType
  title: string
  message: string
  data?: any
}) {
  try {
    // 获取所有管理员用户
    const admins = await prisma.user.findMany({
      where: {
        role: 'admin',
        status: 'active'
      },
      select: { id: true }
    })

    if (admins.length === 0) {
      console.warn('没有找到活跃的管理员用户')
      return []
    }

    // 为每个管理员创建通知
    const notifications = await Promise.all(
      admins.map(admin =>
        createNotification({
          userId: admin.id,
          type,
          title,
          message,
          data
        })
      )
    )

    return notifications
  } catch (error) {
    console.error('为管理员创建通知失败:', error)
    throw error
  }
}

// 新用户注册通知
export async function notifyUserRegistration({
  newUserId,
  userEmail,
  userName
}: {
  newUserId: string
  userEmail: string
  userName?: string
}) {
  const title = '新用户注册'
  const message = `新用户 ${userName || userEmail} 已注册，等待审批`
  
  return createNotificationForAdmins({
    type: NotificationTypes.USER_REGISTRATION,
    title,
    message,
    data: {
      userId: newUserId,
      userEmail,
      userName,
      action: 'user_approval'
    }
  })
}

// 用户需要审批通知
export async function notifyUserApprovalNeeded({
  userId,
  userEmail,
  userName
}: {
  userId: string
  userEmail: string
  userName?: string
}) {
  const title = '用户待审批'
  const message = `用户 ${userName || userEmail} 需要管理员审批`
  
  return createNotificationForAdmins({
    type: NotificationTypes.USER_APPROVAL_NEEDED,
    title,
    message,
    data: {
      userId,
      userEmail,
      userName,
      action: 'user_approval'
    }
  })
}

// 用户审批结果通知
export async function notifyUserApprovalResult({
  userId,
  userEmail,
  userName,
  approved
}: {
  userId: string
  userEmail: string
  userName?: string
  approved: boolean
}) {
  const title = approved ? '用户已通过审批' : '用户审批被拒绝'
  const message = `用户 ${userName || userEmail} 的审批请求已${approved ? '通过' : '被拒绝'}`
  
  return createNotification({
    userId,
    type: approved ? NotificationTypes.USER_APPROVED : NotificationTypes.USER_REJECTED,
    title,
    message,
    data: {
      approved,
      userEmail,
      userName
    }
  })
}

// 活动完成通知
export async function notifyCampaignCompleted({
  userId,
  campaignId,
  campaignName,
  sentCount,
  totalRecipients
}: {
  userId: string
  campaignId: string
  campaignName: string
  sentCount: number
  totalRecipients: number
}) {
  const title = '邮件活动已完成'
  const message = `邮件活动 "${campaignName}" 已完成，成功发送 ${sentCount}/${totalRecipients} 封邮件`
  
  return createNotification({
    userId,
    type: NotificationTypes.CAMPAIGN_COMPLETED,
    title,
    message,
    data: {
      campaignId,
      campaignName,
      sentCount,
      totalRecipients
    }
  })
}

// 获取未读通知数量
export async function getUnreadNotificationCount(userId: string) {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    })
    return count
  } catch (error) {
    console.error('获取未读通知数量失败:', error)
    return 0
  }
}