'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import AttachmentUpload from '@/components/AttachmentUpload'

// 动态导入富文本编辑器，避免SSR问题
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })
import 'react-quill/dist/quill.snow.css'
import '../../quill-custom.css'

interface AttachmentFile {
  name: string
  size: number
  type: string
  url: string
  fileName: string
}

interface Template {
  id: string
  name: string
  subject: string
  htmlContent: string
  content?: string // 兼容性字段
  isRichText: boolean
  attachments?: AttachmentFile[]
  createdAt: string
  updatedAt: string
}

export default function RichTemplatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: ''
  })
  
  // 附件状态
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])

  // 富文本编辑器配置
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'align': [] }],
      ['link', 'image', 'video'],
      ['clean']
    ]
  }

  const quillFormats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'bullet',
    'indent',
    'direction', 'align',
    'link', 'image', 'video'
  ]

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchTemplates()
    }
  }, [status, router])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/templates')
      const data = await response.json()
      
      if (data.templates) {
        // 只显示富文本模板
        const richTextTemplates = data.templates.filter((t: Template) => t.isRichText)
        setTemplates(richTextTemplates)
      }
    } catch (error) {
      console.error('获取模板失败:', error)
      alert('获取模板失败')
    } finally {
      setLoading(false)
    }
  }

  // 附件处理函数
  const handleAttachmentAdd = (attachment: AttachmentFile) => {
    setAttachments(prev => [...prev, attachment])
  }

  const handleAttachmentRemove = (fileName: string) => {
    setAttachments(prev => prev.filter(att => att.fileName !== fileName))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.subject.trim() || !formData.content.trim()) {
      alert('请填写所有必填字段')
      return
    }

    try {
      setLoading(true)
      
      const url = editingTemplate 
        ? '/api/templates/rich'
        : '/api/templates/rich'
      
      const method = editingTemplate ? 'PUT' : 'POST'
      
      const body = editingTemplate 
        ? { ...formData, id: editingTemplate.id, attachments }
        : { ...formData, attachments }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        alert(editingTemplate ? '模板更新成功' : '模板创建成功')
        setShowForm(false)
        setEditingTemplate(null)
        setFormData({ name: '', subject: '', content: '' })
        setAttachments([])
        fetchTemplates()
      } else {
        alert(data.error || '操作失败')
      }
    } catch (error) {
      console.error('操作失败:', error)
      alert('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      subject: template.subject,
      content: template.htmlContent
    })
    setAttachments(template.attachments || [])
    setShowForm(true)
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingTemplate(null)
    setFormData({ name: '', subject: '', content: '' })
    setAttachments([])
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('确定要删除这个模板吗？')) {
      return
    }

    try {
      const response = await fetch(`/api/templates/rich/${templateId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok && data.success) {
        alert('模板删除成功')
        fetchTemplates()
      } else {
        alert(data.error || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败，请重试')
    }
  }



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面头部 */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">富文本邮件模板</h1>
            <p className="mt-2 text-gray-600">创建和管理富文本邮件模板</p>
          </div>
          
          <div className="flex space-x-3">
            <Link
              href="/templates"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              普通模板
            </Link>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              创建富文本模板
            </button>
          </div>
        </div>

        {/* 创建/编辑表单 */}
        {showForm && (
          <div className="mb-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingTemplate ? '编辑模板' : '创建新模板'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    模板名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入模板名称"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    邮件主题 *
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入邮件主题"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮件内容 *
                </label>
                <div className="border border-gray-300 rounded-md">
                  <ReactQuill
                    theme="snow"
                    value={formData.content}
                    onChange={(content) => setFormData({ ...formData, content })}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="请输入邮件内容..."
                    style={{ minHeight: '300px' }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  支持富文本格式：粗体、斜体、下划线、字体颜色、插入链接、图片等
                </p>
              </div>
              
              {/* 附件上传 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮件附件
                </label>
                <AttachmentUpload
                  onAttachmentAdd={handleAttachmentAdd}
                  onAttachmentRemove={handleAttachmentRemove}
                  attachments={attachments}
                  maxFiles={10}
                  maxSize={10}
                />
                <p className="mt-2 text-sm text-gray-500">
                  支持上传PDF、Word、Excel、PPT、图片、压缩包等格式的附件
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '保存中...' : (editingTemplate ? '更新模板' : '创建模板')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 模板列表 */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">富文本模板列表</h2>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-gray-500">暂无富文本模板</div>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                创建第一个富文本模板
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {templates.map((template) => (
                <div key={template.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {template.name}
                        </h3>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          富文本
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">主题:</span> {template.subject}
                      </p>
                      
                      <div className="mb-3">
                        <span className="text-sm font-medium text-gray-600">内容预览:</span>
                        <div 
                          className="mt-1 p-3 bg-gray-50 rounded-md text-sm max-h-32 overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: template.htmlContent }}
                        />
                      </div>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>创建时间: {formatDate(template.createdAt)}</span>
                        <span>更新时间: {formatDate(template.updatedAt)}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(template)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}