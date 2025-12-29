import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcrypt'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('请提供邮箱和密码')
        }
        
        // 处理管理员账户 - 从数据库查找真实的管理员用户
        if (credentials.email === 'admin@admin.com' && credentials.password === 'admin123') {
          const adminUser = await prisma.user.findUnique({
            where: { email: 'admin@admin.com' }
          })
          
          if (adminUser) {
            return {
              id: adminUser.id,
              name: adminUser.name,
              email: adminUser.email,
              role: adminUser.role
            }
          } else {
            // 如果数据库中没有管理员用户，使用硬编码
            return {
              id: 'admin',
              name: '系统管理员',
              email: 'admin@admin.com',
              role: 'admin'
            }
          }
        }
        
        // 普通用户登录逻辑
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })
        
        if (!user || !user.password) {
          throw new Error('用户不存在')
        }
        
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        
        if (!isPasswordValid) {
          throw new Error('密码错误')
        }

        // 检查用户状态
        if (user.status === 'pending') {
          throw new Error('账户待审核，请联系管理员')
        }
        
        if (user.status === 'rejected') {
          throw new Error('账户已被拒绝，请联系管理员')
        }
        
        if (user.status === 'disabled') {
          throw new Error('账户已被停用，请联系管理员')
        }
        
        // 只允许 approved 或 active 状态的用户登录
        if (user.status !== 'approved' && user.status !== 'active') {
          throw new Error('账户状态异常，请联系管理员')
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token && token.sub) {
        session.user.id = token.sub
        session.user.role = token.role
      }
      return session
    }
  },
  debug: process.env.NODE_ENV === 'development',
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24小时
    updateAge: 60 * 60, // 1小时更新一次
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24小时
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/login'
  }
}