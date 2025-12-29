import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'
import { prisma } from './prisma'

export async function getCurrentUser() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return null
    }

    // 如果是管理员账户
    if (session.user.email === 'admin@system.com') {
      return {
        id: 'admin',
        name: '系统管理员',
        email: 'admin@system.com',
        role: 'admin'
      }
    }

    // 普通用户，从数据库获取完整信息
    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return null
    }

    // 检查用户状态
    if (user.status === 'pending') {
      return null
    }

    return user
  } catch (error) {
    console.error('获取当前用户失败:', error)
    return null
  }
}

export async function requireAuth() {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new Error('未授权访问')
  }
  
  return user
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  
  if (!user || user.role !== 'admin') {
    throw new Error('需要管理员权限')
  }
  
  return user
}