import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

// 中文分词和关键词提取的简单实现
function extractKeywords(text: string): string[] {
  // 移除HTML标签
  const cleanText = text.replace(/<[^>]*>/g, ' ')
  
  // 常见的停用词
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '里', '他', '她', '我们', '你们', '他们', '她们', '它们',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ])
  
  // 分词（简单的基于空格和标点符号的分词）
  const words = cleanText
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ') // 保留中文、英文、数字和空格
    .split(/\s+/)
    .filter(word => {
      return word.length >= 2 && // 至少2个字符
             !stopWords.has(word) && // 不是停用词
             !/^\d+$/.test(word) // 不是纯数字
    })
  
  return words
}

// 统计词频
function countWordFrequency(words: string[]): Array<{ text: string; value: number }> {
  const frequency: { [key: string]: number } = {}
  
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1
  })
  
  return Object.entries(frequency)
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 50) // 返回前50个高频词
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '7d'
    const type = searchParams.get('type') || 'all' // 'sent' | 'received' | 'all'

    // 计算时间范围
    const now = new Date()
    let startDate: Date
    
    switch (timeRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    let allTexts: string[] = []

    // 获取发送的邮件内容
    if (type === 'sent' || type === 'all') {
      const sentEmails = await prisma.sentEmail.findMany({
        where: {
          userId: currentUser.id,
          sentAt: {
            gte: startDate
          }
        },
        select: {
          body: true,
          subject: true
        }
      })

      sentEmails.forEach(email => {
        if (email.subject) allTexts.push(email.subject)
        if (email.body) allTexts.push(email.body)
      })
    }

    // 获取收到的回复内容
    if (type === 'received' || type === 'all') {
      const replies = await prisma.emailReply.findMany({
        where: {
          userId: currentUser.id,
          receivedAt: {
            gte: startDate
          }
        },
        select: {
          body: true,
          subject: true
        }
      })

      replies.forEach(reply => {
        if (reply.subject) allTexts.push(reply.subject)
        if (reply.body) allTexts.push(reply.body)
      })
    }

    // 提取所有关键词
    const allKeywords: string[] = []
    allTexts.forEach(text => {
      const keywords = extractKeywords(text)
      allKeywords.push(...keywords)
    })

    // 统计词频
    const wordCloud = countWordFrequency(allKeywords)

    return NextResponse.json({
      wordCloud,
      totalTexts: allTexts.length,
      totalWords: allKeywords.length,
      uniqueWords: wordCloud.length
    })

  } catch (error) {
    console.error('获取词云数据失败:', error)
    return NextResponse.json(
      { error: '获取词云数据失败' },
      { status: 500 }
    )
  }
}