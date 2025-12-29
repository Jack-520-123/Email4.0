import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 默认问候语列表
const DEFAULT_GREETINGS = [
  'Hello!',
  'Hi there!',
  'Dear friend,',
  'Dear Sir/Madam,',
  'Hope you are doing well!',
  'Thank you for your attention!',
  'Nice to connect with you!',
  'Looking forward to our cooperation!',
  'Thank you for your support!',
  'Hope I can be of assistance!',
  'Thank you for your trust!',
  'Wishing you all the best!',
  'Hope we can establish a good partnership!',
  'Thank you for taking your valuable time!',
  'Greetings!',
  'Hope this message finds you well!',
  'Thank you for your interest!',
  'Looking forward to hearing from you!',
  'Best regards,',
  'Warm greetings!'
]

// 获取问候语列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const userId = session.user.id

    // 获取用户自定义问候语
    const userGreetings = await prisma.greeting.findMany({
      where: {
        userId: userId,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 获取用户隐藏的默认问候语内容列表
    const hiddenDefaultContents = await prisma.greeting.findMany({
      where: {
        userId: userId,
        isDefault: false,
        isActive: false
      },
      select: {
        content: true
      }
    })
    
    const hiddenContents = hiddenDefaultContents.map(g => g.content)

    // 获取默认问候语（排除用户隐藏的）
    const defaultGreetings = await prisma.greeting.findMany({
      where: {
        userId: null,
        isDefault: true,
        isActive: true,
        content: {
          notIn: hiddenContents
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // 如果没有默认问候语，创建它们
    if (defaultGreetings.length === 0) {
      await prisma.greeting.createMany({
        data: DEFAULT_GREETINGS.map(content => ({
          content,
          isDefault: true,
          isActive: true,
          userId: null
        }))
      })

      // 重新获取默认问候语
      const newDefaultGreetings = await prisma.greeting.findMany({
        where: {
          userId: null,
          isDefault: true,
          isActive: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      })

      return NextResponse.json({ 
        userGreetings: userGreetings,
        defaultGreetings: newDefaultGreetings
      });
    }

    return NextResponse.json({ 
      userGreetings: userGreetings,
      defaultGreetings: defaultGreetings
    });
  } catch (error) {
    console.error('获取问候语失败:', error)
    return NextResponse.json(
      { error: '获取问候语失败' },
      { status: 500 }
    )
  }
}

// 创建新问候语
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    // 移除授权检查，允许所有用户添加问候语
    if (!session?.user) {
      // 使用默认用户ID或系统ID
      return NextResponse.json({ error: '请先登录后再添加问候语' }, { status: 401 })
    }

    const { content } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: '问候语内容不能为空' },
        { status: 400 }
      )
    }

    const userId = session.user.id

    // 检查是否已存在相同内容的问候语
    const existingGreeting = await prisma.greeting.findFirst({
      where: {
        userId: userId,
        content: content.trim(),
        isActive: true
      }
    })

    if (existingGreeting) {
      return NextResponse.json(
        { error: '该问候语已存在' },
        { status: 400 }
      )
    }

    const greeting = await prisma.greeting.create({
      data: {
        userId: userId,
        content: content.trim(),
        isDefault: false,
        isActive: true
      }
    })

    return NextResponse.json(greeting)
  } catch (error) {
    console.error('创建问候语失败:', error)
    return NextResponse.json(
      { error: '创建问候语失败' },
      { status: 500 }
    )
  }
}

// 获取随机问候语
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const userId = session.user.id

    // 获取所有可用的问候语（用户自定义 + 默认）
    const allGreetings = await prisma.greeting.findMany({
      where: {
        OR: [
          { userId: userId, isActive: true },
          { userId: null, isDefault: true, isActive: true }
        ]
      }
    })

    if (allGreetings.length === 0) {
      return NextResponse.json(
        { error: '没有可用的问候语' },
        { status: 404 }
      )
    }

    // 随机选择一个问候语
    const randomIndex = Math.floor(Math.random() * allGreetings.length)
    const randomGreeting = allGreetings[randomIndex]

    return NextResponse.json({
      greeting: randomGreeting.content
    })
  } catch (error) {
    console.error('获取随机问候语失败:', error)
    return NextResponse.json(
      { error: '获取随机问候语失败' },
      { status: 500 }
    )
  }
}