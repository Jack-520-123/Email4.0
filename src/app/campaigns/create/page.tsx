'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import BreadcrumbNav from '@/components/ui/breadcrumb-nav'

interface Template {
  id: string
  name: string
  subject: string
  htmlContent: string
  content?: string // 兼容性字段
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

export default function CreateCampaignPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateCampaignContent />
    </Suspense>
  )
}

function CreateCampaignContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const excelId = searchParams.get('excelId')
  
  const [formData, setFormData] = useState({
    name: '',
    templateId: '',
    emailProfileId: '',
    excelUploadId: excelId || '',
    recipientListId: '',
    recipientSource: excelId ? 'excelUpload' : '',
    selectedGroups: [] as string[], // 新增：选中的分组
    groupSelectionMode: 'all' as 'all' | 'specific', // 新增：分组选择模式
    scheduledAt: '',
    sendImmediately: true,
    enableRandomInterval: false,
    randomIntervalMin: 60,
    randomIntervalMax: 120
  })

  const [templates, setTemplates] = useState<Template[]>([])
  const [emailProfiles, setEmailProfiles] = useState<EmailProfile[]>([])
  const [excelUploads, setExcelUploads] = useState<ExcelUpload[]>([])
  const [recipientLists, setRecipientLists] = useState<RecipientList[]>([])
  const [availableGroups, setAvailableGroups] = useState<string[]>([]) // 新增：可用分组列表
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status])

  useEffect(() => {
    if (excelId) {
      setFormData(prev => ({
        ...prev,
        excelUploadId: excelId,
        recipientSource: 'excelUpload'
      }))
    }
  }, [excelId])

  const fetchData = async () => {
    try {
      const [templatesRes, emailProfilesRes, excelUploadsRes, recipientListsRes, groupsRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/email-profiles'),
        fetch('/api/excel-upload'),
        fetch('/api/recipient-lists'),
        fetch('/api/recipients/groups/names')
      ])

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json()
        setTemplates(templatesData.templates || [])
      }

      if (emailProfilesRes.ok) {
        const emailProfilesData = await emailProfilesRes.json()
        setEmailProfiles(emailProfilesData.profiles || [])
      }

      if (excelUploadsRes.ok) {
        const excelUploadsData = await excelUploadsRes.json()
        setExcelUploads(excelUploadsData.uploads || [])
      }

      if (recipientListsRes.ok) {
        const recipientListsData = await recipientListsRes.json()
        setRecipientLists(recipientListsData.lists || [])
      }

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json()
        console.log('分组数据:', groupsData) // 调试日志
        const groups = groupsData.groups || []
        console.log('处理后的分组:', groups) // 调试日志
        setAvailableGroups(groups)
      }
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

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
    setIsSubmitting(true)
    setCreating(true)
    setError('')

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
      };
      
      console.log('发送数据:', processedFormData)

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processedFormData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '创建活动失败')
      }

      console.log('活动创建成功:', result)
      
      // 重定向到活动列表页面
      window.location.href = '/campaigns'
      
    } catch (error) {
      console.error('创建活动失败:', error)
      setError(error instanceof Error ? error.message : '创建活动失败')
    } finally {
      setIsSubmitting(false)
      setCreating(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'radio') {
      if (name === 'recipientSource') {
        setFormData(prev => ({ 
          ...prev, 
          recipientSource: value,
          // 重置相关字段
          selectedGroups: [],
          groupSelectionMode: 'all'
        }));
      } else if (name === 'sendTime') {
        setFormData(prev => ({ ...prev, sendImmediately: value === 'immediately' }));
      } else if (name === 'groupSelectionMode') {
        setFormData(prev => ({ 
          ...prev, 
          groupSelectionMode: value as 'all' | 'specific',
          selectedGroups: value === 'all' ? [] : prev.selectedGroups
        }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // 新增：处理分组选择的函数
  const handleGroupSelection = (groupName: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      selectedGroups: checked 
        ? [...prev.selectedGroups, groupName]
        : prev.selectedGroups.filter(g => g !== groupName)
    }));
  };

  const selectedTemplate = templates.find(t => t.id === formData.templateId)
  const selectedExcelUpload = excelUploads.find(u => u.id === formData.excelUploadId)
  const selectedRecipientList = recipientLists.find(r => r.id === formData.recipientListId)

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">加载中...</div>
        </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin')
    return (
      <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">正在跳转到登录页面...</div>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 面包屑导航 */}
        <BreadcrumbNav 
          title="创建发送活动"
          customBackPath="/campaigns"
        />
        

        
        {/* 页面描述 */}
        <div className="mb-8">
          <p className="text-gray-600">配置邮件发送活动的基本信息</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 基本信息 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">基本信息</h2>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  活动名称 *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入活动名称"
                  required
                />
              </div>
            </div>
          </div>

          {/* 邮件模板 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">邮件模板</h2>
            
            <div>
              <label htmlFor="templateId" className="block text-sm font-medium text-gray-700 mb-2">
                选择模板 *
              </label>
              <select
                id="templateId"
                name="templateId"
                value={formData.templateId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            {selectedTemplate && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md">
                <h3 className="text-sm font-medium text-gray-900 mb-2">模板预览</h3>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>主题:</strong> {selectedTemplate.subject}
                </p>
                <div className="text-sm text-gray-600">
                  <strong>内容:</strong>
                  {selectedTemplate.isRichText ? (
                    <div 
                      className="mt-2 p-2 border rounded max-h-32 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: selectedTemplate.htmlContent }}
                    />
                  ) : (
                    <pre className="mt-2 p-2 border rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {selectedTemplate.content || selectedTemplate.htmlContent}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 发件人配置 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">发件人配置</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="emailProfileId" className="block text-sm font-medium text-gray-700 mb-2">
                  选择发件人 *
                </label>
                <select
                  id="emailProfileId"
                  name="emailProfileId"
                  value={formData.emailProfileId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">请选择发件人</option>
                  {emailProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.nickname} ({profile.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={testEmailConnection}
                  disabled={testing || !formData.emailProfileId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {testing ? '测试中...' : '测试连接'}
                </button>
                
                {testResult && (
                  <div className={`text-sm ${
                    testResult.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 收件人配置 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">收件人配置</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  数据源 *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="recipientSource"
                      value="excelUpload"
                      checked={formData.recipientSource === 'excelUpload'}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    Excel文件
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="recipientSource"
                      value="recipientList"
                      checked={formData.recipientSource === 'recipientList'}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    收件人列表
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="recipientSource"
                      value="recipientGroup"
                      checked={formData.recipientSource === 'recipientGroup'}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    按分组选择
                  </label>
                </div>
              </div>

              {formData.recipientSource === 'excelUpload' && (
                <div>
                  <label htmlFor="excelUploadId" className="block text-sm font-medium text-gray-700 mb-2">
                    选择Excel文件 *
                  </label>
                  <select
                    id="excelUploadId"
                    name="excelUploadId"
                    value={formData.excelUploadId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">请选择Excel文件</option>
                    {excelUploads.map((upload) => (
                      <option key={upload.id} value={upload.id}>
                        {upload.originalName} ({upload.totalRecords} 条记录)
                      </option>
                    ))}
                  </select>
                  
                  {selectedExcelUpload && (
                    <div className="mt-2 text-sm text-gray-600">
                      已选择: {selectedExcelUpload.originalName} ({selectedExcelUpload.totalRecords} 条记录)
                    </div>
                  )}
                </div>
              )}

              {formData.recipientSource === 'recipientList' && (
                <div>
                  <label htmlFor="recipientListId" className="block text-sm font-medium text-gray-700 mb-2">
                    选择收件人列表 *
                  </label>
                  <select
                    id="recipientListId"
                    name="recipientListId"
                    value={formData.recipientListId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">请选择收件人列表</option>
                    {recipientLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list._count.recipients} 个收件人)
                      </option>
                    ))}
                  </select>
                  
                  {selectedRecipientList && (
                    <div className="mt-2 text-sm text-gray-600">
                      已选择: {selectedRecipientList.name} ({selectedRecipientList._count.recipients} 个收件人)
                      {selectedRecipientList.description && (
                        <div className="text-gray-500">{selectedRecipientList.description}</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {formData.recipientSource === 'recipientGroup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    分组选择 *
                  </label>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="groupSelectionMode"
                          value="all"
                          checked={formData.groupSelectionMode === 'all'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        所有分组
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="groupSelectionMode"
                          value="specific"
                          checked={formData.groupSelectionMode === 'specific'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        指定分组
                      </label>
                    </div>

                    {formData.groupSelectionMode === 'specific' && (
                      <div className="mt-3">
                        <div className="text-sm text-gray-600 mb-2">请选择要发送的分组：</div>
                        {availableGroups.length > 0 ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                            {availableGroups.map((group) => (
                              <label key={group} className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={formData.selectedGroups.includes(group)}
                                  onChange={(e) => handleGroupSelection(group, e.target.checked)}
                                  className="mr-2"
                                />
                                <span className="text-sm">{group}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 p-3 border border-gray-200 rounded-md">
                            暂无可用分组
                          </div>
                        )}
                        
                        {formData.selectedGroups.length > 0 && (
                          <div className="mt-2 text-sm text-gray-600">
                            已选择 {formData.selectedGroups.length} 个分组: {formData.selectedGroups.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {formData.groupSelectionMode === 'all' && availableGroups.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        将向所有分组发送邮件 (共 {availableGroups.length} 个分组: {availableGroups.join(', ')})
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 发送设置 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">发送设置</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">发送时间 *</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sendTime"
                      value="immediately"
                      checked={formData.sendImmediately}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    立即发送
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sendTime"
                      value="scheduled"
                      checked={!formData.sendImmediately}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    定时发送
                  </label>
                </div>
              </div>

              {!formData.sendImmediately && (
                <div>
                  <label htmlFor="scheduledAt" className="block text-sm font-medium text-gray-700 mb-2">
                    选择发送时间 *
                  </label>
                  <input
                    type="datetime-local"
                    id="scheduledAt"
                    name="scheduledAt"
                    value={formData.scheduledAt}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
              
              {/* 发送间隔设置 */}
              <div className="border-t pt-4">
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
                        onChange={handleInputChange}
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
                        onChange={handleInputChange}
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
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800">{error}</div>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || creating}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {creating ? '创建中...' : '创建活动'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}