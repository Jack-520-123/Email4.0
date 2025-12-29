import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { notifyUserRegistration } from '@/lib/notifications'

// 默认问候语列表
const DEFAULT_GREETINGS = [
  "Hello! Hope you're having a great day!",
  "Hi there! Thanks for connecting with us.",
  "Greetings! We're excited to share this with you.",
  "Hello! Hope this message finds you well.",
  "Hi! We appreciate your time and attention.",
  "Hello! Looking forward to connecting with you.",
  "Hi there! Hope you're doing well today.",
  "Greetings! Thanks for being part of our community.",
  "Hello! We're glad to have you with us.",
  "Hi! Hope this brings value to your day.",
  "Hello! Thanks for your continued support.",
  "Hi there! We're excited to share this update.",
  "Greetings! Hope you find this helpful.",
  "Hello! We appreciate your engagement.",
  "Hi! Thanks for being an important part of our journey.",
  "Hello! Hope this message brightens your day.",
  "Hi there! We're grateful for your attention.",
  "Greetings! Looking forward to your feedback.",
  "Hello! Thanks for taking the time to read this.",
  "Hi! We hope this information serves you well."
]

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    // 验证输入
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: '所有字段都是必填的' },
        { status: 400 }
      )
    }

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 400 }
      )
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 12)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        status: 'approved', // 新用户自动激活，无需审核
        permissions: {
          emailTypes: ['qq', '163', 'gmail', 'outlook', 'hotmail', 'yahoo', 'sina', 'sohu', '126', 'foxmail', 'aliyun', 'work.weixin', 'exmail.qq'],
          maxCampaigns: 10,
          canManageUsers: false,
          canManageSystem: false
        } // 自动分配默认权限
      }
    })

    // 为新用户创建默认问候语
    try {
      await prisma.greeting.createMany({
        data: DEFAULT_GREETINGS.map(content => ({
          userId: user.id,
          content,
          isDefault: false,
          isActive: true
        }))
      })
      console.log('为新用户创建默认问候语成功:', user.id)
    } catch (greetingError) {
      console.error('为新用户创建默认问候语失败:', greetingError)
      // 不影响用户注册流程，只记录错误
    }
    
    console.log('新用户注册成功，自动激活:', { id: user.id, email: user.email, status: user.status })

    // 可选：创建通知给管理员（用于记录新用户注册）
    try {
      await notifyUserRegistration({
        newUserId: user.id,
        userEmail: user.email!,
        userName: user.name || undefined
      })
    } catch (notificationError) {
      console.error('创建注册通知失败:', notificationError)
      // 不影响用户注册流程，只记录错误
    }

    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(
      { 
        message: '注册成功，您可以立即开始使用系统',
        user: userWithoutPassword 
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('注册失败:', error)
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 }
    )
  }
}