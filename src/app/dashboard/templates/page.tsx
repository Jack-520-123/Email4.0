"use client"

'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { toast } from "react-hot-toast"
import { 
  PlusCircle, 
  Search, 
  Mail, 
  Copy, 
  Trash, 
  Edit, 
  Eye, 
  MoreHorizontal,
  Loader2 
} from "lucide-react"
import BreadcrumbNav from "@/components/ui/breadcrumb-nav"

interface Template {
  id: string
  name: string
  subject: string
  htmlContent: string
  content?: string // 兼容性字段
  createdAt: string
  updatedAt: string
}

export default function TemplatesPage() {
  const { data: session } = useSession()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState<string | null>(null)

  // 获取模板列表
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/templates')
      if (!response.ok) {
        throw new Error('获取模板失败')
      }
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取模板失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除模板
  const deleteTemplate = async (id: string) => {
    if (!confirm('确定要删除这个模板吗？')) {
      return
    }

    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setTemplates(templates.filter(t => t.id !== id))
        toast.success('模板删除成功')
      } else {
        // 获取详细错误信息
        const errorData = await response.json().catch(() => ({ error: '删除失败' }))
        const errorMessage = errorData.error || '删除模板失败'
        console.error('删除模板失败:', errorMessage)
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('删除模板失败:', error)
      toast.error('网络错误，请稍后重试')
    }
  }

  // 复制模板
  const duplicateTemplate = async (template: Template) => {
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${template.name} (副本)`,
          subject: template.subject,
          content: template.htmlContent,
        }),
      })
      if (!response.ok) {
        throw new Error('复制模板失败')
      }
      fetchTemplates() // 重新获取模板列表
    } catch (err) {
      alert(err instanceof Error ? err.message : '复制模板失败')
    }
  }

  useEffect(() => {
    if (session) {
      fetchTemplates()
    }
  }, [session])

  const filteredTemplates = searchTerm
    ? templates.filter(
        (template) =>
          template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.subject.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : templates

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
        <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
        <button
          onClick={fetchTemplates}
          className="mt-2 text-sm text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 面包屑导航 */}
      <BreadcrumbNav 
        title="邮件模板"
        customBackPath="/dashboard"
      />
      
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div></div>
        <Link
          href="/dashboard/templates/create"
          className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          新建模板
        </Link>
      </div>

      {/* 搜索框 */}
      <div className="rounded-md border bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="search"
            className="w-full rounded-md border-0 py-2 pl-10 pr-4 text-sm text-gray-900 ring-1 ring-inset ring-transparent placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:bg-gray-800 dark:text-white"
            placeholder="搜索模板..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* 模板列表 */}
      <div className="overflow-hidden rounded-lg border bg-white shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span>名称</span>
                  </div>
                </th>
                <th
                  scope="col"
                  className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell"
                >
                  邮件主题
                </th>
                <th
                  scope="col"
                  className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell"
                >
                  创建日期
                </th>
                <th
                  scope="col"
                  className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell"
                >
                  更新日期
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTemplates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <div className="flex h-full w-full items-center justify-center">
                          <Mail className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="max-w-xs truncate text-sm font-medium text-gray-900 dark:text-white">
                          {template.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400 md:table-cell">
                    {template.subject}
                  </td>
                  <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400 lg:table-cell">
                    {new Date(template.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400 lg:table-cell">
                    {new Date(template.updatedAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <div className="flex items-center justify-end space-x-2">
                      <Link
                        href={`/dashboard/templates/edit/${template.id}`}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                      >
                        <span className="sr-only">编辑</span>
                        <Edit className="h-4 w-4" />
                      </Link>
                      <button
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                        onClick={() => duplicateTemplate(template)}
                      >
                        <span className="sr-only">复制</span>
                        <Copy className="h-4 w-4" />
                      </button>
                      <Link
                        href={`/dashboard/templates/preview/${template.id}`}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                      >
                        <span className="sr-only">预览</span>
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        className="rounded p-1 text-red-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                        onClick={() => {
                          if (window.confirm("确定要删除此模板吗？此操作不可撤销。")) {
                            deleteTemplate(template.id)
                          }
                        }}
                      >
                        <span className="sr-only">删除</span>
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredTemplates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    没有找到匹配的模板
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}