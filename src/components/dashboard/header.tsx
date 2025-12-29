'use client'

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { Menu, Bell, Sun, Moon, LogOut, Settings } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"

interface HeaderProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data?: any
  isRead: boolean
  createdAt: string
}

export default function Header({ sidebarOpen, setSidebarOpen }: HeaderProps) {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  // 获取通知列表
  const fetchNotifications = async () => {
    if (!session?.user) return
    
    try {
      setLoading(true)
      const response = await fetch('/api/notifications?limit=10')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.notifications?.filter((n: Notification) => !n.isRead).length || 0)
      }
    } catch (error) {
      console.error('获取通知失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 标记通知为已读
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH'
      })
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('标记通知已读失败:', error)
    }
  }

  // 处理通知点击
  const handleNotificationClick = async (notification: Notification) => {
    // 标记为已读
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }

    // 根据通知类型跳转到相应页面
    if (notification.type === 'user_registration' || notification.type === 'user_approval_needed') {
      router.push('/admin')
    }
    
    setNotificationsOpen(false)
  }

  // 标记所有通知为已读
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ markAllAsRead: true })
      })
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('标记所有通知已读失败:', error)
    }
  }

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    return `${days}天前`
  }

  useEffect(() => {
    if (session?.user) {
      fetchNotifications()
      // 每30秒刷新一次通知
      const interval = setInterval(fetchNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [session])

  return (
    <header className="sticky top-0 z-30 flex h-16 border-b bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex w-full items-center justify-between px-4">
        {/* 左侧区域 - 移动端菜单按钮和标题 */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-700"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <span className="sr-only">打开侧边栏</span>
            <Menu />
          </button>
          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">欢喜邮件营销系统</h1>
          </div>
        </div>

        {/* 右侧菜单项 - 主题切换、通知、用户信息 */}
        <div className="flex items-center gap-2">
          {/* 主题切换 */}
          <button
            type="button"
            className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            onClick={toggleTheme}
          >
            <span className="sr-only">切换主题</span>
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* 通知 */}
          <div className="relative">
            <button
              type="button"
              className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <span className="sr-only">查看通知</span>
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* 通知弹窗 */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-200 px-4 py-2 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">通知</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{unreadCount}</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          全部已读
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {loading ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      加载中...
                    </div>
                  ) : notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`border-b border-gray-200 px-4 py-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                          !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm text-gray-800 dark:text-gray-200">{notification.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(notification.createdAt)}</p>
                          </div>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full mt-1"></div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      暂无通知
                    </div>
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="border-t border-gray-200 px-4 py-2 dark:border-gray-700">
                    <button
                      onClick={() => {
                        setNotificationsOpen(false)
                        router.push('/notifications')
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      查看全部通知
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 用户菜单 */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <span className="sr-only">用户菜单</span>
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20">
                {session?.user?.name?.charAt(0) || "U"}
              </div>
            </button>

            {/* 用户菜单弹窗 */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-200 px-4 py-2 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{session?.user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{session?.user?.email}</p>
                </div>

                <Link
                  href="/dashboard/profile"
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  账户设置
                </Link>

                <button
                  className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}