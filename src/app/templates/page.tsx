'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { 
  PlusCircle, 
  Search, 
  Mail, 
  Copy, 
  Trash, 
  Edit, 
  Eye, 
  MoreHorizontal,
  Loader2,
  FileText,
  Palette,
  Filter,
  MessageSquare
} from "lucide-react"
import BreadcrumbNav from "@/components/ui/breadcrumb-nav"

interface Template {
  id: string
  name: string
  subject: string
  htmlContent: string
  content?: string // 兼容性字段
  isRichText?: boolean
  createdAt: string
  updatedAt: string
}

type TemplateType = 'all' | 'text' | 'rich'

export default function TemplatesPage() {
  const { data: session } = useSession()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [templateType, setTemplateType] = useState<TemplateType>('all')
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
    if (!confirm('确定要删除这个模板吗？此操作不可撤销。')) {
      return
    }
    
    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('删除模板失败')
      }
      setTemplates(templates.filter(template => template.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除模板失败')
    }
  }

  // 复制模板
  const duplicateTemplate = async (template: Template) => {
    try {
      const endpoint = template.isRichText ? '/api/templates/rich' : '/api/templates'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${template.name} (副本)`,
          subject: template.subject,
          content: template.htmlContent,
          isRichText: template.isRichText || false,
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

  // 过滤模板
  const filteredTemplates = templates.filter(template => {
    // 按类型过滤
    if (templateType === 'text' && template.isRichText) return false
    if (templateType === 'rich' && !template.isRichText) return false
    
    // 按搜索词过滤
    if (searchTerm) {
      return (
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.htmlContent.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    return true
  })

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
        showBackButton={false}
      />
      
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div></div>
        <div className="flex gap-2">
          <Link
            href="/greetings"
            className="flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            问候语管理
          </Link>
          <Link
            href="/templates/create"
            className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <FileText className="mr-2 h-4 w-4" />
            文本模板
          </Link>
          <Link
            href="/templates/rich/create"
            className="flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <Palette className="mr-2 h-4 w-4" />
            富文本模板
          </Link>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* 搜索框 */}
        <div className="flex-1">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="search"
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
              placeholder="搜索模板..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        {/* 类型过滤 */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value as TemplateType)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">全部模板</option>
            <option value="text">文本模板</option>
            <option value="rich">富文本模板</option>
          </select>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center">
            <Mail className="h-5 w-5 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">总模板数</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{templates.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">文本模板</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {templates.filter(t => !t.isRichText).length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center">
            <Palette className="h-5 w-5 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">富文本模板</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {templates.filter(t => t.isRichText).length}
              </p>
            </div>
          </div>
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
                  类型
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
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTemplates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {template.isRichText ? (
                        <Palette className="h-5 w-5 text-purple-600 mr-3" />
                      ) : (
                        <FileText className="h-5 w-5 text-green-600 mr-3" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {template.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-6 py-4 whitespace-nowrap md:table-cell">
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      template.isRichText 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    }`}>
                      {template.isRichText ? '富文本' : '文本'}
                    </span>
                  </td>
                  <td className="hidden px-6 py-4 whitespace-nowrap md:table-cell">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {template.subject}
                    </div>
                  </td>
                  <td className="hidden px-6 py-4 whitespace-nowrap lg:table-cell">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(template.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <Link
                        href={template.isRichText ? `/templates/rich/edit/${template.id}` : `/templates/edit/${template.id}`}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="编辑"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                      <Link
                        href={template.isRichText ? `/templates/rich/preview/${template.id}` : `/templates/preview/${template.id}`}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="预览"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => duplicateTemplate(template)}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                        title="复制"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="删除"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredTemplates.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Mail className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {searchTerm || templateType !== 'all' ? '没有找到匹配的模板' : '暂无模板'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || templateType !== 'all' 
                ? '尝试调整搜索条件或过滤器' 
                : '开始创建您的第一个邮件模板'
              }
            </p>
            {!searchTerm && templateType === 'all' && (
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  href="/templates/create"
                  className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  创建文本模板
                </Link>
                <Link
                  href="/templates/rich/create"
                  className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
                >
                  <Palette className="mr-2 h-4 w-4" />
                  创建富文本模板
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}