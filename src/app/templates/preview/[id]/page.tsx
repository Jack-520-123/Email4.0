'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Template {
  id: string
  name: string
  subject: string
  content: string
  htmlContent: string
  isRichText: boolean
  createdAt: string
  updatedAt: string
}

export default function TemplatePreviewPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session, status } = useSession()
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated' && params.id) {
      fetchTemplate()
    }
  }, [status, params.id])

  const fetchTemplate = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/templates/${params.id}`)
      
      if (!response.ok) {
        throw new Error('获取模板失败')
      }
      
      const data = await response.json()
      setTemplate(data.template)
    } catch (error) {
      console.error('获取模板失败:', error)
      setError(error instanceof Error ? error.message : '获取模板失败')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">正在跳转到登录页面...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <Link
            href="/templates"
            className="text-blue-600 hover:text-blue-800"
          >
            返回模板列表
          </Link>
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 mb-4">模板不存在</div>
          <Link
            href="/templates"
            className="text-blue-600 hover:text-blue-800"
          >
            返回模板列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 头部导航 */}
        <div className="mb-8">
          <Link
            href="/templates"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回模板列表
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            模板预览
          </h1>
          <p className="mt-2 text-gray-600">
            预览模板内容和样式
          </p>
        </div>

        {/* 模板信息 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              {template.name}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              创建时间: {new Date(template.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>
          
          <div className="px-6 py-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邮件主题
              </label>
              <div className="p-3 bg-gray-50 rounded-md border">
                {template.subject}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邮件内容
              </label>
              <div className="border rounded-md">
                {template.isRichText ? (
                  <div 
                    className="p-4 prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: template.htmlContent }}
                  />
                ) : (
                  <pre className="p-4 whitespace-pre-wrap font-sans text-sm">
                    {template.content || template.htmlContent}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-between">
          <Link
            href="/templates"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            返回列表
          </Link>
          
          <Link
            href={`/templates/edit/${template.id}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            编辑模板
          </Link>
        </div>
      </div>
    </div>
  )
}