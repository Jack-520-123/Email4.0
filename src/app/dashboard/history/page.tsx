'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Mail,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  Download
} from 'lucide-react'
import { getStatusColor } from '@/config/colors'

interface EmailHistory {
  id: string
  templateName: string
  subject: string
  recipientListName: string
  recipientCount: number
  sentAt: string
  status: 'pending' | 'sending' | 'completed' | 'failed'
  successCount: number
  failedCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  emailProfileName: string
}

interface EmailDetail {
  id: string
  recipientEmail: string
  status: 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked'
  sentAt: string
  deliveredAt?: string
  openedAt?: string
  clickedAt?: string
  errorMessage?: string
}

export default function HistoryPage() {
  const { data: session } = useSession()
  const [history, setHistory] = useState<EmailHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedHistory, setSelectedHistory] = useState<EmailHistory | null>(null)
  const [emailDetails, setEmailDetails] = useState<EmailDetail[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // 获取发送历史
  const fetchHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/email-history')
      if (!response.ok) {
        throw new Error('获取发送历史失败')
      }
      const data = await response.json()
      setHistory(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取发送历史失败')
    } finally {
      setLoading(false)
    }
  }

  // 获取邮件详情
  const fetchEmailDetails = async (historyId: string) => {
    try {
      setDetailsLoading(true)
      const response = await fetch(`/api/email-history/${historyId}/details`)
      if (!response.ok) {
        throw new Error('获取邮件详情失败')
      }
      const data = await response.json()
      setEmailDetails(data)
    } catch (err) {
      console.error('获取邮件详情失败:', err)
    } finally {
      setDetailsLoading(false)
    }
  }

  // 查看详情
  const handleViewDetails = async (historyItem: EmailHistory) => {
    setSelectedHistory(historyItem)
    setShowDetails(true)
    await fetchEmailDetails(historyItem.id)
  }



  useEffect(() => {
    if (session) {
      fetchHistory()
    }
  }, [session])

  // 过滤历史记录
  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      item.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.recipientListName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // 状态显示组件
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      pending: { color: getStatusColor('pending'), icon: Clock, text: '等待中' },
      sending: { color: getStatusColor('sending'), icon: Mail, text: '发送中' },
      completed: { color: getStatusColor('completed'), icon: CheckCircle, text: '已完成' },
      failed: { color: getStatusColor('failed'), icon: XCircle, text: '失败' },
      sent: { color: getStatusColor('sent'), icon: Mail, text: '已发送' },
      delivered: { color: getStatusColor('delivered'), icon: CheckCircle, text: '已送达' },
      opened: { color: getStatusColor('opened'), icon: Eye, text: '已打开' },
      clicked: { color: getStatusColor('clicked'), icon: CheckCircle, text: '已点击' },
      bounced: { color: getStatusColor('bounced'), icon: XCircle, text: '退回' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
    
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
        <Icon className="mr-1 h-3 w-3" />
        {config.text}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载发送历史中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
        <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
        <button
          onClick={fetchHistory}
          className="mt-2 flex items-center text-sm text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">发送历史</h1>
        <button
          onClick={fetchHistory}
          className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </button>
      </div>

      {/* 搜索和过滤 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索模板名称、主题或收件人列表..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">全部状态</option>
            <option value="pending">等待中</option>
            <option value="sending">发送中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
          </select>
        </div>
      </div>

      {/* 历史记录列表 */}
      <div className="rounded-lg border bg-white shadow dark:border-gray-700 dark:bg-gray-800">
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {searchTerm || statusFilter !== 'all' ? '未找到匹配的记录' : '暂无发送历史'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== 'all' ? '请尝试调整搜索条件' : '开始发送邮件后，历史记录将显示在这里'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    模板信息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    收件人
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    发送时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    统计
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.templateName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {item.subject}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          邮箱: {item.emailProfileName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.recipientListName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {item.recipientCount} 人
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(item.sentAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-green-600 dark:text-green-400">
                          成功: {item.successCount}
                        </div>
                        <div className="text-red-600 dark:text-red-400">
                          失败: {item.failedCount}
                        </div>
                        <div className="text-blue-600 dark:text-blue-400">
                          打开: {item.openedCount}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewDetails(item)}
                          className="flex items-center text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          详情
                        </button>

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {showDetails && selectedHistory && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowDetails(false)} />
            
            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle">
              <div className="bg-white px-4 pt-5 pb-4 dark:bg-gray-800 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    发送详情 - {selectedHistory.templateName}
                  </h3>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>
                
                {/* 统计概览 */}
                <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">总发送</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedHistory.recipientCount}
                    </div>
                  </div>
                  <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">成功</div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-400">
                      {selectedHistory.successCount}
                    </div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">打开</div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-400">
                      {selectedHistory.openedCount}
                    </div>
                  </div>
                  <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                    <div className="text-sm font-medium text-red-600 dark:text-red-400">失败</div>
                    <div className="text-2xl font-bold text-red-900 dark:text-red-400">
                      {selectedHistory.failedCount}
                    </div>
                  </div>
                </div>
                
                {/* 详细列表 */}
                <div className="max-h-96 overflow-y-auto">
                  {detailsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <span className="ml-2 text-gray-600 dark:text-gray-400">加载详情中...</span>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            收件人
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            状态
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            时间
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            备注
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                        {emailDetails.map((detail) => (
                          <tr key={detail.id}>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {detail.recipientEmail}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={detail.status} />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {detail.openedAt ? new Date(detail.openedAt).toLocaleString('zh-CN') :
                               detail.deliveredAt ? new Date(detail.deliveredAt).toLocaleString('zh-CN') :
                               new Date(detail.sentAt).toLocaleString('zh-CN')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {detail.errorMessage || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 dark:bg-gray-700 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  onClick={() => setShowDetails(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}