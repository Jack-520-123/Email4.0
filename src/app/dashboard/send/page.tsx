'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Send,
  Mail,
  Users,
  Settings,
  Eye,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import BreadcrumbNav from '@/components/ui/breadcrumb-nav'

interface Template {
  id: string
  name: string
  subject: string
  htmlContent: string
  content?: string // 兼容性字段
}

interface RecipientList {
  id: string
  name: string
  _count: {
    recipients: number
  }
}

interface EmailProfile {
  id: string
  nickname: string
  email: string
  smtpServer: string
  smtpPort: number
}

interface SendResult {
  success: boolean
  totalSent: number
  successCount: number
  failureCount: number
  errors: string[]
}

export default function SendEmailPage() {
  const { data: session } = useSession()
  const [templates, setTemplates] = useState<Template[]>([])
  const [recipientLists, setRecipientLists] = useState<RecipientList[]>([])
  const [emailProfiles, setEmailProfiles] = useState<EmailProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  
  const [formData, setFormData] = useState({
    templateId: '',
    recipientListId: '',
    emailProfileId: '',
    customSubject: '',
    useCustomSubject: false
  })
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // 获取所有必需的数据
  const fetchData = async () => {
    try {
      setLoading(true)
      const [templatesRes, listsRes, profilesRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/recipient-lists'),
        fetch('/api/email-profiles')
      ])

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json()
        setTemplates(templatesData.templates || [])
      }

      if (listsRes.ok) {
        const listsData = await listsRes.json()
        setRecipientLists(listsData.lists || [])
      }

      if (profilesRes.ok) {
        const profilesData = await profilesRes.json()
        setEmailProfiles(profilesData.profiles || [])
      }
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 发送邮件
  const handleSend = async () => {
    if (!formData.templateId || !formData.recipientListId || !formData.emailProfileId) {
      alert('请填写所有必需字段')
      return
    }

    try {
      setSending(true)
      setSendResult(null)
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: formData.templateId,
          recipientListId: formData.recipientListId,
          emailProfileId: formData.emailProfileId,
          customSubject: formData.useCustomSubject ? formData.customSubject : undefined
        }),
      })

      const result = await response.json()
      
      if (response.ok) {
        setSendResult(result)
      } else {
        throw new Error(result.error || '发送失败')
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '发送邮件失败')
    } finally {
      setSending(false)
    }
  }

  // 预览模板
  const handlePreview = () => {
    const template = templates.find(t => t.id === formData.templateId)
    if (template) {
      setSelectedTemplate(template)
      setShowPreview(true)
    }
  }

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session])

  // 当选择模板时，更新自定义主题
  useEffect(() => {
    const template = templates.find(t => t.id === formData.templateId)
    if (template && !formData.useCustomSubject) {
      setFormData(prev => ({ ...prev, customSubject: template.subject }))
    }
  }, [formData.templateId, formData.useCustomSubject, templates])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 面包屑导航 */}
      <BreadcrumbNav 
        title="发送邮件"
        customBackPath="/dashboard"
      />
      
      {/* 页面描述 */}
      <div>
        <p className="text-gray-600 dark:text-gray-400">
          选择模板、收件人列表和邮箱配置来发送邮件
        </p>
      </div>

      {/* 发送结果 */}
      {sendResult && (
        <div className={`rounded-lg border p-4 ${
          sendResult.success 
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
        }`}>
          <div className="flex items-center">
            {sendResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <h3 className={`ml-2 text-sm font-medium ${
              sendResult.success 
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }`}>
              {sendResult.success ? '发送完成' : '发送失败'}
            </h3>
          </div>
          <div className={`mt-2 text-sm ${
            sendResult.success 
              ? 'text-green-700 dark:text-green-300'
              : 'text-red-700 dark:text-red-300'
          }`}>
            <p>总计: {sendResult.totalSent} 封邮件</p>
            <p>成功: {sendResult.successCount} 封</p>
            <p>失败: {sendResult.failureCount} 封</p>
            {sendResult.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">错误详情:</p>
                <ul className="mt-1 list-disc list-inside">
                  {sendResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 发送表单 */}
      <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="space-y-6">
          {/* 选择模板 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <Mail className="mr-2 inline h-4 w-4" />
              选择邮件模板 *
            </label>
            <select
              value={formData.templateId}
              onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">请选择模板</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} - {template.subject}
                </option>
              ))}
            </select>
            {formData.templateId && (
              <button
                type="button"
                onClick={handlePreview}
                className="mt-2 flex items-center text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                <Eye className="mr-1 h-4 w-4" />
                预览模板
              </button>
            )}
          </div>

          {/* 自定义主题 */}
          <div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useCustomSubject"
                checked={formData.useCustomSubject}
                onChange={(e) => setFormData({ ...formData, useCustomSubject: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="useCustomSubject" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                自定义邮件主题
              </label>
            </div>
            {formData.useCustomSubject && (
              <input
                type="text"
                value={formData.customSubject}
                onChange={(e) => setFormData({ ...formData, customSubject: e.target.value })}
                className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="输入自定义主题"
              />
            )}
          </div>

          {/* 选择收件人列表 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <Users className="mr-2 inline h-4 w-4" />
              选择收件人列表 *
            </label>
            <select
              value={formData.recipientListId}
              onChange={(e) => setFormData({ ...formData, recipientListId: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">请选择收件人列表</option>
              {recipientLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list._count.recipients} 个收件人)
                </option>
              ))}
            </select>
          </div>

          {/* 选择邮箱配置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <Settings className="mr-2 inline h-4 w-4" />
              选择发送邮箱 *
            </label>
            <select
              value={formData.emailProfileId}
              onChange={(e) => setFormData({ ...formData, emailProfileId: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">请选择发送邮箱</option>
              {emailProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.nickname} ({profile.email})
                </option>
              ))}
            </select>
          </div>

          {/* 发送按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={sending || !formData.templateId || !formData.recipientListId || !formData.emailProfileId}
              className="flex items-center rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  发送中...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  发送邮件
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 预览模态框 */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                模板预览: {selectedTemplate.name}
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  主题
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {formData.useCustomSubject ? formData.customSubject : selectedTemplate.subject}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  内容
                </label>
                <div 
                  className="mt-1 prose max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: selectedTemplate.htmlContent }}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {(templates.length === 0 || recipientLists.length === 0 || emailProfiles.length === 0) && (
        <div className="rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                配置不完整
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>发送邮件前，请确保已配置以下内容：</p>
                <ul className="mt-1 list-disc list-inside">
                  {templates.length === 0 && <li>至少创建一个邮件模板</li>}
                  {recipientLists.length === 0 && <li>至少创建一个收件人列表</li>}
                  {emailProfiles.length === 0 && <li>至少配置一个发送邮箱</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}