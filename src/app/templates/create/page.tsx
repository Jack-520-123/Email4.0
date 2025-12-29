'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Eye } from 'lucide-react'
import BreadcrumbNav from '@/components/ui/breadcrumb-nav'

export default function CreateTemplatePage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('表单提交被触发')
    
    if (!formData.name.trim() || !formData.subject.trim() || !formData.content.trim()) {
      console.log('表单验证失败: 缺少必要字段')
      alert('请填写完整的模板信息')
      return
    }

    console.log('开始提交表单，数据:', formData)
    setLoading(true)
    try {
      console.log('发送POST请求到 /api/templates')
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          isRichText: false
        }),
      })

      console.log('收到响应:', response.status, response.statusText)
      if (!response.ok) {
        const error = await response.json()
        console.log('API错误:', error)
        throw new Error(error.message || '创建模板失败')
      }

      const result = await response.json()
      console.log('创建成功:', result)
      router.push('/templates')
    } catch (error) {
      console.error('提交失败:', error)
      alert(error instanceof Error ? error.message : '创建模板失败')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* 面包屑导航 */}
        <BreadcrumbNav 
          title="创建邮件模板"
          customBackPath="/templates"
        />
        
        {/* 页面描述 */}
        <div className="mb-8">
          <p className="text-gray-600 dark:text-gray-400">
            创建一个新的邮件模板，用于发送邮件活动
          </p>
        </div>
 
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? '隐藏预览' : '显示预览'}
              </button>
            </div>
          </div>

          <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
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
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
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
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
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
                      name="content"
                      rows={12}
                      value={formData.content}
                      onChange={handleInputChange}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      placeholder="请输入邮件内容...\n\n可用占位符：\n{{name}} - 收件人姓名\n{{greeting}} - 随机问候语"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Link
                    href="/templates"
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    取消
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {loading ? '创建中...' : '创建模板'}
                  </button>
                </div>
              </form>
            </div>

            {/* 预览面板 */}
            {showPreview && (
              <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">预览</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      模板名称
                    </label>
                    <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      {formData.name || '(未填写)'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      邮件主题
                    </label>
                    <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      {formData.subject || '(未填写)'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      邮件内容
                    </label>
                    <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded min-h-[200px] whitespace-pre-wrap">
                      {formData.content || '(未填写)'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}