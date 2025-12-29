'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  Mail,
  Users,
  FileText,
  BarChart3,
  Settings,
  Send,
  List,
  Upload,
  Palette,
  UserCheck,
  MessageSquare,
  MailOpen,
  Monitor,
  Wrench,
  AlertTriangle,
  Play,
} from "lucide-react"

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isAdmin = session?.user?.role === "admin"

  const menuItems = [
    {
      title: "仪表板",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      title: "邮件模板",
      href: "/templates",
      icon: FileText,
      active: pathname?.startsWith("/templates"),
    },
    {
      title: "问候语管理",
      href: "/greetings",
      icon: MessageSquare,
      active: pathname?.startsWith("/greetings"),
    },
    {
      title: "发送活动",
      href: "/campaigns",
      icon: Send,
      active: pathname?.startsWith("/campaigns"),
    },
    {
      title: "邮件监听",
      href: "/email-monitor",
      icon: Monitor,
      active: pathname?.startsWith("/email-monitor"),
    },
    {
      title: "邮件预热",
      href: "/warmup",
      icon: Mail,
      active: pathname?.startsWith("/warmup"),
    },
    {
      title: "发件人配置",
      href: "/sender-config",
      icon: UserCheck,
      active: pathname?.startsWith("/sender-config"),
    },
    {
      title: "收件人管理",
      href: "/dashboard/recipients",
      icon: Users,
      active: pathname?.startsWith("/dashboard/recipients") && !pathname?.startsWith("/dashboard/failed-recipients"),
    },
    {
      title: "失败邮箱管理",
      href: "/dashboard/failed-recipients",
      icon: AlertTriangle,
      active: pathname?.startsWith("/dashboard/failed-recipients"),
    },

    // 管理员菜单
    ...(isAdmin
      ? [
        {
          title: "系统设置",
          href: "/dashboard/settings",
          icon: Settings,
          active: pathname?.startsWith("/dashboard/settings"),
        },
        {
          title: "系统诊断",
          href: "/debug",
          icon: Wrench,
          active: pathname?.startsWith("/debug"),
        },
        {
          title: "管理员面板",
          href: "/admin",
          icon: UserCheck,
          active: pathname?.startsWith("/admin"),
        },
      ]
      : [])
  ]

  return (
    <div className="h-full overflow-y-auto border-r bg-white px-3 py-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-6 flex items-center px-3">
        <div className="text-xl font-bold text-gray-900 dark:text-white">欢喜邮件营销系统</div>
      </div>
      <nav className="space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center rounded-md px-3 py-2 text-sm font-medium ${item.active
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
          >
            <item.icon
              className={`mr-3 h-5 w-5 flex-shrink-0 ${item.active
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300"
                }`}
            />
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="mt-10">
        <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-900/30">
          <div className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">当前版本</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">v1.0.0</div>
        </div>
      </div>

      {/* 猫咪图标 */}
      <div className="mt-4 flex justify-center">
        <div className="text-6xl" title="欢喜猫咪">
          <svg width="120" height="120" viewBox="0 0 80 80" fill="none" className="text-orange-500 hover:text-orange-400 transition-colors duration-300">
            {/* 猫咪头部 */}
            <ellipse cx="40" cy="45" rx="22" ry="18" fill="currentColor" opacity="0.9" />
            {/* 猫咪耳朵 */}
            <path d="M22 32 L28 18 L34 32 Z" fill="currentColor" />
            <path d="M46 32 L52 18 L58 32 Z" fill="currentColor" />
            {/* 内耳 */}
            <path d="M25 29 L28 22 L31 29 Z" fill="#ff6b6b" />
            <path d="M49 29 L52 22 L55 29 Z" fill="#ff6b6b" />
            {/* 开心的眼睛（弯月形） */}
            <path d="M30 40 Q33 37 36 40" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M44 40 Q47 37 50 40" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* 眼睛下方的小点（更可爱） */}
            <circle cx="33" cy="42" r="1" fill="#ff6b6b" opacity="0.6" />
            <circle cx="47" cy="42" r="1" fill="#ff6b6b" opacity="0.6" />
            {/* 鼻子（更大更可爱） */}
            <path d="M40 48 L37 52 L43 52 Z" fill="#ff6b6b" />
            {/* 开心的嘴巴（向上弯曲） */}
            <path d="M40 52 Q35 56 30 58" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M40 52 Q45 56 50 58" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* 胡须（更长更明显） */}
            <line x1="18" y1="44" x2="26" y2="42" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="48" x2="26" y2="48" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="52" x2="26" y2="54" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="54" y1="42" x2="62" y2="44" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="54" y1="48" x2="62" y2="48" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="54" y1="54" x2="62" y2="52" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            {/* 开心的腮红 */}
            <ellipse cx="25" cy="50" rx="3" ry="2" fill="#ff9999" opacity="0.4" />
            <ellipse cx="55" cy="50" rx="3" ry="2" fill="#ff9999" opacity="0.4" />
          </svg>
        </div>
      </div>
    </div>
  )
}