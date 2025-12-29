import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import AuthProvider from '@/components/auth-provider'
import AppInitializer from '@/components/app-initializer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '欢喜邮件营销系统',
  description: '专业的邮件营销与群发平台，支持自定义模板、数据分析',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AppInitializer />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}