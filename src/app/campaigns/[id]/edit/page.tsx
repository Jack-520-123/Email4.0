'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import BreadcrumbNav from '@/components/ui/breadcrumb-nav'
import { CampaignStatus } from '@prisma/client'

interface Campaign {
  id: string
  name: string
  status: string
  sentCount: number
  totalRecipients: number
  randomIntervalMin: number
  randomIntervalMax: number
  enableRandomInterval: boolean
  sendStartTime: string | null
  sendEndTime: string | null
  enableTimeLimit: boolean
  template: {
    id: string
    name: string
    subject: string
  }
  emailProfile: {
    id: string
    nickname: string
    email: string
  }
  excelUpload?: {
    id: string
    originalName: string
    totalRecords: number
  }
  recipientList?: {
    id: string
    name: string
    description?: string
    _count: {
      recipients: number
    }
  }
  recipientSource?: string
  selectedGroups?: string[]
  groupSelectionMode?: 'all' | 'specific'
  scheduledAt?: string
  sendImmediately?: boolean
}

interface Template {
  id: string
  name: string
  subject: string
  htmlContent: string
  content?: string
  isRichText: boolean
}

interface EmailProfile {
  id: string
  nickname: string
  email: string
  smtpServer: string
  smtpPort: number
}

interface ExcelUpload {
  id: string
  originalName: string
  totalRecords: number
}

interface RecipientList {
  id: string
  name: string
  description?: string
  _count: {
    recipients: number
  }
}



export default function EditCampaignPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [emailProfiles, setEmailProfiles] = useState<EmailProfile[]>([])
  const [excelUploads, setExcelUploads] = useState<ExcelUpload[]>([])
  const [recipientLists, setRecipientLists] = useState<RecipientList[]>([])
  const [availableGroups, setAvailableGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    templateId: '',
    emailProfileId: '',
    excelUploadId: '',
    recipientListId: '',
    recipientSource: '',
    selectedGroups: [] as string[], // 新增：选中的分组
    groupSelectionMode: 'all' as 'all' | 'specific', // 新增：分组选择模式
    scheduledAt: '',
    sendImmediately: true,
    enableRandomInterval: false,
    randomIntervalMin: 60,
    randomIntervalMax: 120
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchCampaign()
      fetchData()
    }
  }, [status, router, campaignId])

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`)
      const data = await response.json()
      
      if (data.campaign) {
        const campaignData = data.campaign
        setCampaign(campaignData)
        
        // 检查是否可以编辑
        if (![CampaignStatus.DRAFT, CampaignStatus.PAUSED, CampaignStatus.STOPPED].includes(campaignData.status)) {
          alert('只有草稿、暂停或停止状态的活动才能编辑')
          router.push('/campaigns')
          return
        }
        
        // 确定收件人数据源
        let recipientSource = 'excelUpload'
        if (campaignData.recipientList) {
          recipientSource = 'recipientList'
        } else if (campaignData.selectedGroups && campaignData.selectedGroups.length > 0) {
          recipientSource = 'recipientGroup'
        }
        
        // 解析 selectedGroups 字段
        let parsedSelectedGroups = []
        if (campaignData.selectedGroups) {
          try {
            parsedSelectedGroups = typeof campaignData.selectedGroups === 'string' 
              ? JSON.parse(campaignData.selectedGroups)
              : campaignData.selectedGroups
          } catch (error) {
            console.error('解析 selectedGroups 失败:', error)
            parsedSelectedGroups = []
          }
        }
        
        setFormData({
          name: campaignData.name,
          templateId: campaignData.template.id,
          emailProfileId: campaignData.emailProfile.id,
          recipientSource,
          excelUploadId: campaignData.excelUpload?.id || '',
          recipientListId: campaignData.recipientList?.id || '',
          groupSelectionMode: campaignData.groupSelectionMode || 'all',
          selectedGroups: parsedSelectedGroups,
          sendImmediately: campaignData.sendImmediately !== false,
          scheduledAt: campaignData.scheduledAt || '',
          enableRandomInterval: campaignData.enableRandomInterval,
          randomIntervalMin: campaignData.randomIntervalMin,
          randomIntervalMax: campaignData.randomIntervalMax
        })
      } else {
        alert(data.error || '获取活动信息失败')
        router.push('/campaigns')
      }
    } catch (error) {
      console.error('获取活动信息失败:', error)
      alert('获取活动信息失败')
      router.push('/campaigns')
    } finally {
      setLoading(false)
    }
  }

  // 获取基础数据
  const fetchData = async () => {
    try {
      const [templatesRes, profilesRes, uploadsRes, listsRes, groupsRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/email-profiles'),
        fetch('/api/excel-upload'),
        fetch('/api/recipient-lists'),
        fetch('/api/recipients/groups/names')
      ])

      const [templatesData, profilesData, uploadsData, listsData, groupsData] = await Promise.all([
        templatesRes.json(),
        profilesRes.json(),
        uploadsRes.json(),
        listsRes.json(),
        groupsRes.json()
      ])

      if (templatesData.templates) {
        setTemplates(templatesData.templates)
      }
      if (profilesData.profiles) {
        setEmailProfiles(profilesData.profiles)
      }
      if (uploadsData.uploads) {
        setExcelUploads(uploadsData.uploads)
      }
      if (listsData.lists) {
        setRecipientLists(listsData.lists)
      }
      if (groupsData.groups) {
        // /api/recipients/groups/names 返回简单的字符串数组
        setAvailableGroups(groupsData.groups || [])
      }
    } catch (error) {
      console.error('获取数据失败:', error)
    }
  }

  // 测试邮箱连接
  const testEmailConnection = async () => {
    if (!formData.emailProfileId) {
      setTestResult({ success: false, message: '请先选择发件人' })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch(`/api/email-profiles/${formData.emailProfileId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const data = await response.json()

      if (response.ok) {
        setTestResult({ success: true, message: '邮箱连接测试成功！' })
      } else {
        let errorMessage = data.error || '邮箱连接测试失败'
        
        // 如果有建议，添加到错误信息中
        if (data.suggestions && data.suggestions.length > 0) {
          errorMessage += '\n\n解决建议：\n' + data.suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')
        }
        
        // 如果有详细错误信息，添加到错误信息中
        if (data.details && data.details.code) {
          errorMessage += `\n\n错误代码：${data.details.code}`
        }
        
        setTestResult({ success: false, message: errorMessage })
      }
    } catch (error) {
      console.error('测试邮箱连接失败:', error)
      setTestResult({ success: false, message: '网络错误，请稍后重试' })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // 验证必填字段
      if (!formData.name.trim()) {
        throw new Error('请输入活动名称')
      }
      if (!formData.templateId) {
        throw new Error('请选择邮件模板')
      }
      if (!formData.emailProfileId) {
        throw new Error('请选择发件人')
      }
      if (!formData.recipientSource) {
        throw new Error('请选择收件人数据源')
      }
      if (formData.recipientSource === 'recipientList' && !formData.recipientListId) {
        throw new Error('请选择收件人列表')
      }
      if (formData.recipientSource === 'excelUpload' && !formData.excelUploadId) {
        throw new Error('请选择Excel文件')
      }
      if (formData.recipientSource === 'recipientGroup' && formData.groupSelectionMode === 'specific' && formData.selectedGroups.length === 0) {
        throw new Error('请至少选择一个分组')
      }
      
      // 验证发送间隔设置
      if (formData.enableRandomInterval) {
        if (formData.randomIntervalMin <= 0 || formData.randomIntervalMax <= 0) {
          throw new Error('发送间隔必须大于0秒')
        }
        if (formData.randomIntervalMin >= formData.randomIntervalMax) {
          throw new Error('最小间隔必须小于最大间隔')
        }
      }

      // 准备提交数据
      const processedFormData = {
        ...formData,
        scheduledAt: formData.sendImmediately ? null : formData.scheduledAt,
        // 根据收件人数据源设置相关字段为 null
        excelUploadId: formData.recipientSource === 'excelUpload' && formData.excelUploadId ? formData.excelUploadId : null,
        recipientListId: formData.recipientSource === 'recipientList' && formData.recipientListId ? formData.recipientListId : null,
        id: campaignId
      };
      
      console.log('发送数据:', processedFormData)

      const response = await fetch(`/api/campaigns/${campaignId}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processedFormData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '更新活动失败')
      }

      console.log('活动更新成功:', result)
      
      // 显示成功消息
      alert('活动保存成功！')
      
      // 使用 window.location.href 强制刷新页面数据
      window.location.href = '/campaigns'
      
    } catch (error) {
      console.error('更新活动失败:', error)
      alert(error instanceof Error ? error.message : '更新活动失败')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">活动不存在</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <BreadcrumbNav 
          title="编辑活动"
          customBackPath="/campaigns"
        />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">编辑活动</h1>
          <p className="mt-2 text-gray-600">修改草稿、暂停或停止状态的活动配置</p>
          {campaign && (
            <div className="mt-2 text-sm text-gray-500">
              当前状态：
              <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                campaign.status === CampaignStatus.DRAFT ? 'bg-gray-100 text-gray-800' :
                campaign.status === CampaignStatus.PAUSED ? 'bg-yellow-100 text-yellow-800' :
                campaign.status === CampaignStatus.STOPPED ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {campaign.status === CampaignStatus.DRAFT ? '草稿' :
                 campaign.status === CampaignStatus.PAUSED ? '已暂停' :
                 campaign.status === CampaignStatus.STOPPED ? '已停止' : campaign.status}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 活动名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                活动名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入活动名称"
                required
              />
            </div>

            {/* 邮件模板 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邮件模板 *
              </label>
              <select
                value={formData.templateId}
                onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">请选择邮件模板</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.subject}
                  </option>
                ))}
              </select>
            </div>

            {/* 发件人配置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                发件人配置 *
              </label>
              <div className="flex space-x-2">
                <select
                  value={formData.emailProfileId}
                  onChange={(e) => setFormData({ ...formData, emailProfileId: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">请选择发件人配置</option>
                  {emailProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.nickname} ({profile.email})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={testEmailConnection}
                  disabled={!formData.emailProfileId || testing}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? '测试中...' : '测试连接'}
                </button>
              </div>
              
              {/* 测试结果显示 */}
              {testResult && (
                <div className={`mt-4 p-3 rounded-md ${
                  testResult.success 
                    ? 'bg-green-50 border border-green-200 text-green-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      {testResult.success ? (
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">
                        {testResult.success ? '连接成功' : '连接失败'}
                      </p>
                      <div className="mt-1 text-sm whitespace-pre-line">
                        {testResult.message}
                      </div>
                    </div>
                  </div>
                </div>
              )}            </div>

            {/* 收件人配置 */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">收件人配置</h3>
              
              {/* 数据源选择 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  数据源 *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="recipientSource"
                      value="excelUpload"
                      checked={formData.recipientSource === 'excelUpload'}
                      onChange={(e) => setFormData({ ...formData, recipientSource: e.target.value })}
                      className="mr-2"
                    />
                    <div>
                      <div className="font-medium">Excel 文件</div>
                      <div className="text-sm text-gray-500">从上传的 Excel 文件中选择</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="recipientSource"
                      value="recipientList"
                      checked={formData.recipientSource === 'recipientList'}
                      onChange={(e) => setFormData({ ...formData, recipientSource: e.target.value })}
                      className="mr-2"
                    />
                    <div>
                      <div className="font-medium">收件人列表</div>
                      <div className="text-sm text-gray-500">从已创建的收件人列表中选择</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="recipientSource"
                      value="recipientGroup"
                      checked={formData.recipientSource === 'recipientGroup'}
                      onChange={(e) => setFormData({ ...formData, recipientSource: e.target.value })}
                      className="mr-2"
                    />
                    <div>
                      <div className="font-medium">按分组选择</div>
                      <div className="text-sm text-gray-500">从收件人分组中选择</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Excel 文件选择 */}
              {formData.recipientSource === 'excelUpload' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择 Excel 文件 *
                  </label>
                  <select
                    value={formData.excelUploadId}
                    onChange={(e) => setFormData({ ...formData, excelUploadId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">请选择 Excel 文件</option>
                    {excelUploads.map((upload) => (
                      <option key={upload.id} value={upload.id}>
                        {upload.originalName} ({upload.totalRecords} 条记录)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 收件人列表选择 */}
              {formData.recipientSource === 'recipientList' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择收件人列表 *
                  </label>
                  <select
                    value={formData.recipientListId}
                    onChange={(e) => setFormData({ ...formData, recipientListId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              )}

              {/* 分组选择 */}
              {formData.recipientSource === 'recipientGroup' && (
                <div className="mb-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      分组选择模式 *
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="groupSelectionMode"
                          value="all"
                          checked={formData.groupSelectionMode === 'all'}
                          onChange={(e) => setFormData({ ...formData, groupSelectionMode: e.target.value as 'all' | 'specific' })}
                          className="mr-2"
                        />
                        <span>所有分组</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="groupSelectionMode"
                          value="specific"
                          checked={formData.groupSelectionMode === 'specific'}
                          onChange={(e) => setFormData({ ...formData, groupSelectionMode: e.target.value as 'all' | 'specific' })}
                          className="mr-2"
                        />
                        <span>指定分组</span>
                      </label>
                    </div>
                  </div>

                  {formData.groupSelectionMode === 'specific' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        选择分组 *
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                        {availableGroups.map((group) => (
                          <label key={group} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.selectedGroups.includes(group)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    selectedGroups: [...formData.selectedGroups, group]
                                  })
                                } else {
                                  setFormData({
                                    ...formData,
                                    selectedGroups: formData.selectedGroups.filter(name => name !== group)
                                  })
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">
                              {group}
                            </span>
                          </label>
                        ))}
                      </div>
                      
                      {formData.selectedGroups.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600">
                          已选择 {formData.selectedGroups.length} 个分组: {formData.selectedGroups.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <p className="text-sm text-yellow-600">
                注意：更改收件人数据将重置发送进度
              </p>
            </div>

            {/* 发送时间设置 */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">发送时间设置</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  发送时间 *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sendTiming"
                      checked={formData.sendImmediately}
                      onChange={() => setFormData({ ...formData, sendImmediately: true, scheduledAt: '' })}
                      className="mr-2"
                    />
                    <span>立即发送</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sendTiming"
                      checked={!formData.sendImmediately}
                      onChange={() => setFormData({ ...formData, sendImmediately: false })}
                      className="mr-2"
                    />
                    <span>定时发送</span>
                  </label>
                </div>
              </div>

              {!formData.sendImmediately && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    发送时间 *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={!formData.sendImmediately}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <p className="text-sm text-gray-500 mt-1">请选择未来的时间</p>
                </div>
              )}
            </div>

            {/* 发送间隔设置 */}
            <div className="border-t pt-6">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="enableRandomInterval"
                  name="enableRandomInterval"
                  checked={formData.enableRandomInterval}
                  onChange={(e) => setFormData(prev => ({ ...prev, enableRandomInterval: e.target.checked }))}
                  className="mr-2"
                />
                <label htmlFor="enableRandomInterval" className="text-sm font-medium text-gray-700">
                  启用随机发送间隔
                </label>
              </div>
              
              {formData.enableRandomInterval && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="randomIntervalMin" className="block text-sm font-medium text-gray-700 mb-2">
                      最小间隔（秒）
                    </label>
                    <input
                      type="number"
                      id="randomIntervalMin"
                      name="randomIntervalMin"
                      value={formData.randomIntervalMin}
                      onChange={(e) => setFormData({ ...formData, randomIntervalMin: parseInt(e.target.value) })}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="最小间隔秒数"
                    />
                  </div>
                  <div>
                    <label htmlFor="randomIntervalMax" className="block text-sm font-medium text-gray-700 mb-2">
                      最大间隔（秒）
                    </label>
                    <input
                      type="number"
                      id="randomIntervalMax"
                      name="randomIntervalMax"
                      value={formData.randomIntervalMax}
                      onChange={(e) => setFormData({ ...formData, randomIntervalMax: parseInt(e.target.value) })}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="最大间隔秒数"
                    />
                  </div>
                </div>
              )}
              
              {formData.enableRandomInterval && (
                <div className="mt-2 text-sm text-gray-600">
                  <p>系统将在 {formData.randomIntervalMin} 到 {formData.randomIntervalMax} 秒之间随机选择发送间隔</p>
                  {formData.randomIntervalMin >= formData.randomIntervalMax && (
                    <p className="text-red-600 mt-1">⚠️ 最小间隔应小于最大间隔</p>
                  )}
                </div>
              )}
            </div>



            {/* 提交按钮 */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Link
                href="/campaigns"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '保存中...' : '保存修改'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}