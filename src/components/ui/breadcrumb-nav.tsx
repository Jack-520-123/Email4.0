'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, Home } from 'lucide-react'
import Link from 'next/link'

interface BreadcrumbNavProps {
  title?: string
  showBackButton?: boolean
  showHomeButton?: boolean
  customBackPath?: string
  className?: string
  action?: React.ReactNode
}

export default function BreadcrumbNav({
  title,
  showBackButton = true,
  showHomeButton = true,
  customBackPath,
  className = '',
  action
}: BreadcrumbNavProps) {
  const router = useRouter()
  const pathname = usePathname()

  // 生成面包屑路径
  const generateBreadcrumbs = () => {
    const paths = pathname.split('/').filter(Boolean)
    const breadcrumbs = []

    // 添加主页
    breadcrumbs.push({ name: '主页', href: '/dashboard' })

    // 根据路径生成面包屑
    let currentPath = ''
    for (let i = 0; i < paths.length; i++) {
      currentPath += `/${paths[i]}`
      let name = paths[i]

      // 路径名称映射
      const pathNameMap: { [key: string]: string } = {
        'dashboard': '仪表板',
        'templates': '邮件模板',
        'campaigns': '发送活动',
        'greetings': '问候语管理',
        'recipients': '收件人管理',
        'email-profiles': '邮箱配置',
        'recipient-lists': '收件人列表',
        'analytics': '数据分析',
        'history': '发送历史',
        'settings': '系统设置',
        'send': '发送邮件',
        'create': '创建',
        'edit': '编辑',
        'rich': '富文本模板',
        'excel-upload': 'Excel上传',
        'sender-config': '发件人配置',
        'admin': '管理员'
      }

      name = pathNameMap[name] || name

      // 如果是最后一个路径且有自定义标题，使用自定义标题
      if (i === paths.length - 1 && title) {
        name = title
      }

      breadcrumbs.push({ name, href: currentPath })
    }

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  // 计算智能返回路径（当浏览器历史不可用时使用）
  const getSmartBackPath = () => {
    const paths = pathname.split('/').filter(Boolean)
    if (paths.length <= 1) {
      return '/dashboard' // 如果只有一级路径，返回仪表板
    }
    // 返回上一级路径
    return '/' + paths.slice(0, -1).join('/')
  }

  const handleBack = () => {
    if (customBackPath) {
      router.push(customBackPath)
    } else {
      // 检查是否有浏览器历史记录
      // 注意：window.history.length 在新标签页或直接访问时可能为1或2
      if (typeof window !== 'undefined' && window.history.length > 2) {
        router.back()
      } else {
        // 没有历史记录时，使用智能路径
        router.push(getSmartBackPath())
      }
    }
  }

  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      {/* 左侧：面包屑导航 */}
      <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.href} className="flex items-center">
            {index > 0 && (
              <span className="mx-2 text-gray-400">/</span>
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {crumb.name}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {crumb.name}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center space-x-3">
        {action && (
          <div className="flex items-center">
            {action}
          </div>
        )}

        {showHomeButton && (
          <Link
            href="/dashboard"
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            返回主页
          </Link>
        )}

        {showBackButton && (
          <button
            onClick={handleBack}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回上级
          </button>
        )}
      </div>
    </div>
  )
}

// 简化版本的面包屑组件，只显示返回按钮
export function SimpleBreadcrumb({
  title,
  backPath,
  className = ''
}: {
  title: string
  backPath?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  const handleBack = () => {
    if (backPath) {
      router.push(backPath)
    } else {
      // 计算智能返回路径
      const paths = pathname.split('/').filter(Boolean)
      const smartBackPath = paths.length <= 1 ? '/dashboard' : '/' + paths.slice(0, -1).join('/')

      if (typeof window !== 'undefined' && window.history.length > 2) {
        router.back()
      } else {
        router.push(smartBackPath)
      }
    }
  }

  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
        >
          <Home className="w-4 h-4 mr-2" />
          返回主页
        </Link>

        <button
          onClick={handleBack}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          返回上级
        </button>
      </div>

    </div>
  )
}