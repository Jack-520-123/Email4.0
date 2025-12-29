'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, Save, Eye } from 'lucide-react'

// 动态导入富文本编辑器
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })
import 'react-quill/dist/quill.snow.css'
import '../../../quill-custom.css'

export default function CreateRichTemplatePage() {
  const router = useRouter()
  const quillRef = useRef<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: ''
  })
  const [loading, setLoading] = useState(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.subject.trim() || !formData.content.trim()) {
      alert('请填写完整的模板信息')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/templates/rich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          isRichText: true
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '创建模板失败')
      }

      router.push('/templates')
    } catch (error) {
      alert(error instanceof Error ? error.message : '创建模板失败')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleContentChange = (content: string) => {
    setFormData(prev => ({ ...prev, content }))
  }

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
    'link', 'image', 'color', 'background',
    'align', 'code-block'
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/templates"
            className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            返回模板列表
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">创建富文本模板</h1>
        </div>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              
              <div className="border border-gray-300 rounded-md dark:border-gray-600">
                <ReactQuill
                  theme="snow"
                  value={formData.content}
                  onChange={handleContentChange}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{ minHeight: '300px' }}
                  placeholder="请输入邮件内容..."
                />
              </div>
              
              {/* 可用变量标签说明 */}
               <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
                 <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">可用变量标签</h4>
                 <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                   <div><code>{"{{recipient_name}}"}</code> - 收件人姓名（来自Excel表格中的"姓名"列）</div>
                   <div><code>{"{{greeting}}"}</code> - 问候语（系统随机选择）</div>
                   <div><code>{"{{timestamp}}"}</code> - 当前时间戳（如：2024/1/15 14:30:25）</div>
                 </div>
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
                <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded min-h-[200px] prose prose-sm max-w-none">
                  {formData.content ? (
                    <div dangerouslySetInnerHTML={{ __html: formData.content }} />
                  ) : (
                    <span className="text-gray-500">(未填写)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}