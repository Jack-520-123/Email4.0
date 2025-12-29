'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, Save, Eye, Loader2 } from 'lucide-react'

interface Template {
  id: string
  name: string
  subject: string
  htmlContent: string
  isRichText: boolean
}

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const { data: session, status } = useSession()
  const [template, setTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // 获取模板数据
  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/templates/${params.id}`)
      if (!response.ok) {
        throw new Error('获取模板失败')
      }
      const data = await response.json()
      setTemplate(data)
      setFormData({
        name: data.name,
        subject: data.subject,
        content: data.htmlContent
      })
    } catch (error) {
      console.error('获取模板失败:', error)
      alert('获取模板失败')
      router.push('/templates')
    } finally {
      setLoading(false)
    }
  }

  // 保存模板
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.subject.trim() || !formData.content.trim()) {
      alert('请填写完整的模板信息')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/templates/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          subject: formData.subject,
          content: formData.content
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '保存模板失败')
      }

      alert('模板保存成功')
      router.push('/templates')
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存模板失败')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetchTemplate()
  }, [session, status, params.id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">模板不存在</h2>
          <Link href="/templates" className="mt-4 text-blue-600 hover:text-blue-500">
            返回模板列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 头部 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/templates"
                className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回模板列表
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? '隐藏预览' : '显示预览'}
              </button>
            </div>
          </div>
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              编辑模板 - {template.name}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              编辑您的邮件模板内容
            </p>
          </div>
        </div>

        <div className={`grid gap-8 ${showPreview ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
          {/* 编辑表单 */}
          <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  模板名称
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="请输入模板名称"
                  required
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  邮件主题
                </label>
                <input
                  type="text"
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="请输入邮件主题"
                  required
                />
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  邮件内容
                </label>
                <div className="mt-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = document.getElementById('content') as HTMLTextAreaElement
                        if (!textarea) return
                        const start = textarea.selectionStart
                        const end = textarea.selectionEnd
                        const newContent = formData.content.substring(0, start) + '{{name}}' + formData.content.substring(end)
                        setFormData({ ...formData, content: newContent })
                        setTimeout(() => {
                          textarea.focus()
                          textarea.setSelectionRange(start + 8, start + 8)
                        }, 0)
                      }}
                      className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                    >
                      插入姓名 {'{'}{'{'} name {'}'}{'}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = document.getElementById('content') as HTMLTextAreaElement
                        if (!textarea) return
                        const start = textarea.selectionStart
                        const end = textarea.selectionEnd
                        const newContent = formData.content.substring(0, start) + '{{greeting}}' + formData.content.substring(end)
                        setFormData({ ...formData, content: newContent })
                        setTimeout(() => {
                          textarea.focus()
                          textarea.setSelectionRange(start + 12, start + 12)
                        }, 0)
                      }}
                      className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
                    >
                      插入问候语 {'{'}{'{'} greeting {'}'}{'}'}
                    </button>
                  </div>
                  <textarea
                    id="content"
                    rows={12}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="请输入邮件内容...\n\n可用占位符：\n{{name}} - 收件人姓名\n{{greeting}} - 随机问候语"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Link
                  href="/templates"
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  取消
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-800"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saving ? '保存中...' : '保存模板'}
                </button>
              </div>
            </form>
          </div>

          {/* 预览区域 */}
          {showPreview && (
            <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">预览</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">主题:</h4>
                  <p className="mt-1 text-gray-900 dark:text-white">{formData.subject || '(无主题)'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">内容:</h4>
                  <div className="mt-1 rounded border bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700">
                    <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
                      {formData.content || '(无内容)'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}