/**
 * 用户画像服务
 * 负责收集、分析和管理用户行为数据
 */

import { prisma } from './prisma'
import { InteractionType } from '@prisma/client'

export interface UserProfileData {
  recipientEmail: string
  recipientName?: string
  company?: string
  position?: string
  industry?: string
  location?: string
  tags?: string[]
}

export interface InteractionData {
  type: InteractionType
  sentEmailId?: string
  details?: any
  userAgent?: string
  ipAddress?: string
  deviceType?: string
  location?: string
}

export interface RadarChartData {
  subject: string
  value: number
  fullMark: 100
}

export class UserProfileService {
  /**
   * 创建或更新用户画像
   */
  static async createOrUpdateProfile(
    userId: string,
    profileData: UserProfileData
  ) {
    try {
      const existingProfile = await prisma.userProfile.findUnique({
        where: { recipientEmail: profileData.recipientEmail }
      })

      if (existingProfile) {
        return await prisma.userProfile.update({
          where: { id: existingProfile.id },
          data: {
            ...profileData,
            updatedAt: new Date()
          }
        })
      } else {
        return await prisma.userProfile.create({
          data: {
            userId,
            ...profileData,
            firstContactAt: new Date()
          }
        })
      }
    } catch (error) {
      console.error('创建/更新用户画像失败:', error)
      throw error
    }
  }

  /**
   * 记录用户交互
   */
  static async recordInteraction(
    recipientEmail: string,
    interactionData: InteractionData
  ) {
    try {
      // 查找或创建用户画像
      let userProfile = await prisma.userProfile.findUnique({
        where: { recipientEmail }
      })

      if (!userProfile) {
        // 如果用户画像不存在，从发送邮件记录中获取基础信息
        const sentEmail = await prisma.sentEmail.findFirst({
          where: { recipientEmail },
          orderBy: { sentAt: 'desc' }
        })

        if (sentEmail) {
          userProfile = await this.createOrUpdateProfile(sentEmail.userId, {
            recipientEmail,
            recipientName: sentEmail.recipientName || undefined
          })
        } else {
          throw new Error('无法找到用户信息')
        }
      }

      // 记录交互
      const interaction = await prisma.userInteraction.create({
        data: {
          userProfileId: userProfile.id,
          ...interactionData
        }
      })

      // 更新用户画像统计数据
      await this.updateProfileStats(userProfile.id)

      return interaction
    } catch (error) {
      console.error('记录用户交互失败:', error)
      throw error
    }
  }

  /**
   * 更新用户画像统计数据
   */
  static async updateProfileStats(userProfileId: string) {
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { id: userProfileId },
        include: {
          interactions: {
            orderBy: { timestamp: 'desc' }
          }
        }
      })

      if (!profile) return

      const interactions = profile.interactions
      
      // 统计各类交互数量
      const emailsSent = interactions.filter(i => i.type === 'EMAIL_SENT').length
      const emailsOpened = interactions.filter(i => i.type === 'EMAIL_OPENED').length
      const emailsClicked = interactions.filter(i => i.type === 'EMAIL_CLICKED').length
      const emailsReplied = interactions.filter(i => i.type === 'EMAIL_REPLIED').length

      // 计算比率
      const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0
      const clickRate = emailsOpened > 0 ? (emailsClicked / emailsOpened) * 100 : 0
      const replyRate = emailsSent > 0 ? (emailsReplied / emailsSent) * 100 : 0

      // 计算参与度分数 (综合指标)
      const engagementScore = (
        openRate * 0.3 + 
        clickRate * 0.4 + 
        replyRate * 0.3
      )

      // 分析最活跃时间段
      const preferredEmailTime = this.analyzePreferredTime(interactions)

      // 分析设备类型
      const deviceType = this.analyzeDeviceType(interactions)

      // 更新画像数据
      await prisma.userProfile.update({
        where: { id: userProfileId },
        data: {
          totalEmailsReceived: emailsSent,
          totalEmailsOpened: emailsOpened,
          totalEmailsClicked: emailsClicked,
          totalReplies: emailsReplied,
          openRate,
          clickRate,
          replyRate,
          engagementScore,
          preferredEmailTime,
          deviceType,
          lastActivityAt: interactions[0]?.timestamp || new Date(),
          updatedAt: new Date()
        }
      })
    } catch (error) {
      console.error('更新用户画像统计失败:', error)
      throw error
    }
  }

  /**
   * 分析用户最活跃的时间段
   */
  private static analyzePreferredTime(interactions: any[]): string {
    const timeSlots: { [key: string]: number } = {
      '早晨(6-9)': 0,
      '上午(9-12)': 0,
      '下午(12-18)': 0,
      '晚上(18-22)': 0,
      '深夜(22-6)': 0
    }

    interactions.forEach(interaction => {
      const hour = new Date(interaction.timestamp).getHours()
      if (hour >= 6 && hour < 9) timeSlots['早晨(6-9)']++
      else if (hour >= 9 && hour < 12) timeSlots['上午(9-12)']++
      else if (hour >= 12 && hour < 18) timeSlots['下午(12-18)']++
      else if (hour >= 18 && hour < 22) timeSlots['晚上(18-22)']++
      else timeSlots['深夜(22-6)']++
    })

    return Object.entries(timeSlots)
      .sort(([,a], [,b]) => b - a)[0][0]
  }

  /**
   * 分析用户主要使用的设备类型
   */
  private static analyzeDeviceType(interactions: any[]): string {
    const deviceCounts: { [key: string]: number } = {}
    
    interactions.forEach(interaction => {
      if (interaction.deviceType) {
        deviceCounts[interaction.deviceType] = (deviceCounts[interaction.deviceType] || 0) + 1
      }
    })

    return Object.entries(deviceCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown'
  }

  /**
   * 获取用户画像雷达图数据
   */
  static async getRadarChartData(userId: string): Promise<RadarChartData[]> {
    try {
      const profiles = await prisma.userProfile.findMany({
        where: { userId },
        select: {
          openRate: true,
          clickRate: true,
          replyRate: true,
          engagementScore: true
        }
      })

      if (profiles.length === 0) {
        return [
          { subject: '打开率', value: 0, fullMark: 100 },
          { subject: '点击率', value: 0, fullMark: 100 },
          { subject: '回复率', value: 0, fullMark: 100 },
          { subject: '参与度', value: 0, fullMark: 100 },
          { subject: '活跃度', value: 0, fullMark: 100 }
        ]
      }

      // 计算平均值
      const avgOpenRate = profiles.reduce((sum, p) => sum + p.openRate, 0) / profiles.length
      const avgClickRate = profiles.reduce((sum, p) => sum + p.clickRate, 0) / profiles.length
      const avgReplyRate = profiles.reduce((sum, p) => sum + p.replyRate, 0) / profiles.length
      const avgEngagement = profiles.reduce((sum, p) => sum + p.engagementScore, 0) / profiles.length
      
      // 计算活跃度（基于最近30天的交互）
      const recentInteractions = await prisma.userInteraction.count({
        where: {
          userProfile: { userId },
          timestamp: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
      const activityScore = Math.min(recentInteractions * 10, 100) // 每个交互10分，最高100分

      return [
        { subject: '打开率', value: Math.round(avgOpenRate), fullMark: 100 },
        { subject: '点击率', value: Math.round(avgClickRate), fullMark: 100 },
        { subject: '回复率', value: Math.round(avgReplyRate), fullMark: 100 },
        { subject: '参与度', value: Math.round(avgEngagement), fullMark: 100 },
        { subject: '活跃度', value: Math.round(activityScore), fullMark: 100 }
      ]
    } catch (error) {
      console.error('获取雷达图数据失败:', error)
      return [
        { subject: '打开率', value: 0, fullMark: 100 },
        { subject: '点击率', value: 0, fullMark: 100 },
        { subject: '回复率', value: 0, fullMark: 100 },
        { subject: '参与度', value: 0, fullMark: 100 },
        { subject: '活跃度', value: 0, fullMark: 100 }
      ]
    }
  }

  /**
   * 获取用户画像列表
   */
  static async getUserProfiles(
    userId: string,
    options: {
      page?: number
      limit?: number
      sortBy?: 'engagementScore' | 'lastActivityAt' | 'createdAt'
      sortOrder?: 'asc' | 'desc'
      tags?: string[]
    } = {}
  ) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'engagementScore',
      sortOrder = 'desc',
      tags
    } = options

    const where: any = { userId }
    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      }
    }

    const [profiles, total] = await Promise.all([
      prisma.userProfile.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          interactions: {
            take: 5,
            orderBy: { timestamp: 'desc' }
          }
        }
      }),
      prisma.userProfile.count({ where })
    ])

    return {
      profiles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * 添加标签到用户画像
   */
  static async addTags(userProfileId: string, tags: string[]) {
    const profile = await prisma.userProfile.findUnique({
      where: { id: userProfileId }
    })

    if (!profile) throw new Error('用户画像不存在')

    const newTags = [...new Set([...profile.tags, ...tags])]
    
    return await prisma.userProfile.update({
      where: { id: userProfileId },
      data: { tags: newTags }
    })
  }

  /**
   * 移除标签
   */
  static async removeTags(userProfileId: string, tags: string[]) {
    const profile = await prisma.userProfile.findUnique({
      where: { id: userProfileId }
    })

    if (!profile) throw new Error('用户画像不存在')

    const newTags = profile.tags.filter(tag => !tags.includes(tag))
    
    return await prisma.userProfile.update({
      where: { id: userProfileId },
      data: { tags: newTags }
    })
  }
}

/**
 * 从User-Agent解析设备类型
 */
export function parseDeviceType(userAgent?: string): string {
  if (!userAgent) return 'unknown'
  
  const ua = userAgent.toLowerCase()
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile'
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet'
  } else {
    return 'desktop'
  }
}

/**
 * 从IP地址获取地理位置（简化版）
 */
export function parseLocation(ipAddress?: string): string {
  // 这里可以集成第三方IP地理位置服务
  // 目前返回默认值
  return 'unknown'
}