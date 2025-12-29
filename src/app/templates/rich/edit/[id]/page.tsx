'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, Save, Eye, Loader2 } from 'lucide-react'

// 动态导入富文本编辑器
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })
import 'react-quill/dist/quill.snow.css'
import '../../../../quill-custom.css'

interface Template {
  id: string
  name: string
  subject: string
  htmlContent: string
  isRichText: boolean
}

export default function EditRichTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const { data: session, status } = useSession()
  const quillRef = useRef<any>(null)
  const [template, setTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [quillReady, setQuillReady] = useState(false)

  // 简化初始化逻辑
  useEffect(() => {
    // 直接设置为准备就绪
    setQuillReady(true)
  }, [])

  // 插入占位符的通用函数 - 强制插入
  const insertPlaceholder = useCallback((placeholder: string) => {
    if (quillRef.current) {
      try {
        const editor = quillRef.current.getEditor()
        if (editor) {
          const selection = editor.getSelection()
          const index = selection ? selection.index : editor.getLength()
          
          // 插入带样式的占位符
          editor.insertText(index, placeholder, {
            'background': '#fef3c7',
            'color': '#d97706',
            'bold': true
          })
          
          editor.setSelection(index + placeholder.length)
          return
        }
      } catch (error) {
        console.error('插入占位符失败:', error)
        // 编辑器未准备好时的备用方案
      }
    }
    // 备用方案：直接更新content状态
    setFormData(prev => ({
      ...prev,
      content: prev.content + placeholder
    }))
  }, [])

  // 富文本编辑器配置
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link', 'image'],
      ['clean']
    ],
  }

  const quillFormats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'color', 'background', 'align', 'code-block'
  ]

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
      const response = await fetch(`/api/templates/rich/${params.id}`, {
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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
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
              编辑富文本模板 - {template.name}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              编辑您的富文本邮件模板内容
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
                
                {/* 占位符插入按钮 */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">快速插入占位符</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{recipient_name}}')}
                      className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                    >
                      插入收件人姓名
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{greeting}}')}
                      className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
                    >
                      插入问候语
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{timestamp}}')}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                    >
                      插入时间戳
                    </button>
                  </div>
                </div>
                
                <div className="mt-1">
                  <ReactQuill
                    theme="snow"
                    value={formData.content}
                    onChange={(content) => setFormData({ ...formData, content })}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="请输入邮件内容..."
                    style={{ height: '300px', marginBottom: '50px' }}
                  />
                </div>
                
                {/* 可用变量标签说明 */}
                <div className="mt-4 bg-blue-50 p-4 dark:bg-blue-900/20">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">可用变量标签</h3>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                    您可以在邮件内容中使用以下变量，系统会在发送时自动替换：
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-400">
                    <li><code>{"{{recipient_name}}"}</code> - 收件人姓名（来自Excel表格中的"姓名"列）</li>
                    <li><code>{"{{greeting}}"}</code> - 问候语</li>
                    <li><code>{"{{timestamp}}"}</code> - 当前时间戳（如：2024/1/15 14:30:25）</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
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
                    <div 
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: formData.content || '(无内容)' }}
                    />
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