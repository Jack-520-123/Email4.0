'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BreadcrumbNav from '@/components/ui/breadcrumb-nav'
import { CampaignStatus } from '@prisma/client'
import { EyeIcon, PencilIcon } from '@heroicons/react/24/outline'
import { campaignLogger } from '@/lib/campaign-logger'

interface Campaign {
  id: string
  name: string
  status: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  failedCount: number
  createdAt: string
  updatedAt: string
  isRunning?: boolean
  isPaused?: boolean
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
}

export default function CampaignsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [pendingTasks, setPendingTasks] = useState(0)
  const [isTriggering, setIsTriggering] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [logRefreshInterval, setLogRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [logCampaignInfo, setLogCampaignInfo] = useState<any>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchCampaigns();
      checkPendingTasks();
    }
  }, [status, router, statusFilter, pagination.page]);

  // 定期检查待处理任务
  useEffect(() => {
    if (status === 'authenticated') {
      const interval = setInterval(checkPendingTasks, 30000); // 每30秒检查一次
      return () => clearInterval(interval);
    }
  }, [status]);

  // 优化的状态轮询 - 增加状态变化确认和防抖处理
  useEffect(() => {
    const activeCampaigns = campaigns.filter(c => c.status === CampaignStatus.SENDING);
    if (activeCampaigns.length === 0) return;

    // 状态变化确认计数器
    const statusChangeCounters = new Map<string, { count: number, lastStatus: any }>();

    const interval = setInterval(() => {
      activeCampaigns.forEach(campaign => {
        fetch(`/api/campaigns/${campaign.id}`)
          .then(res => {
            if (res.ok) {
              return res.json();
            }
            return null;
          })
          .then(data => {
            if (data && data.campaign) {
              const newCampaign = data.campaign;
              
              // 检查关键状态变化
              const currentKey = `${newCampaign.status}-${newCampaign.isRunning}-${newCampaign.isPaused || false}`;
              const oldKey = `${campaign.status}-${campaign.isRunning || false}-${campaign.isPaused || false}`;
              
              if (currentKey !== oldKey) {
                // 状态发生变化，进行确认计数
                const counter = statusChangeCounters.get(campaign.id) || { count: 0, lastStatus: oldKey };
                
                if (counter.lastStatus === currentKey) {
                  counter.count++;
                } else {
                  counter.count = 1;
                  counter.lastStatus = currentKey;
                  
                  // 记录状态变化检测日志
                  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
                    campaignLogger.logPolling(campaign.id, {
                      action: 'STATUS_CHANGE_DETECTED',
                      oldStatusKey: oldKey,
                      newStatusKey: currentKey,
                      oldStatus: campaign.status,
                      newStatus: newCampaign.status
                    }, 'FRONTEND_POLLING');
                  }
                }
                
                statusChangeCounters.set(campaign.id, counter);
                
                // 需要连续3次确认才更新状态（防抖处理）
                if (counter.count >= 3) {
                  console.log(`[前端] 活动 ${campaign.id} 状态变化已确认: ${oldKey} -> ${currentKey}`);
                  
                  // 记录状态确认日志
                  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
                    campaignLogger.logPolling(campaign.id, {
                      action: 'STATUS_CONFIRMED',
                      oldStatus: campaign.status,
                      newStatus: newCampaign.status,
                      oldIsRunning: campaign.isRunning,
                      newIsRunning: newCampaign.isRunning,
                      confirmCount: counter.count
                    }, 'FRONTEND_POLLING');
                  }
                  
                  setCampaigns(prevCampaigns =>
                    prevCampaigns.map(c =>
                      c.id === campaign.id ? { ...c, ...newCampaign } : c
                    )
                  );
                  statusChangeCounters.delete(campaign.id);
                } else {
                  console.log(`[前端] 活动 ${campaign.id} 状态变化待确认 (${counter.count}/3): ${oldKey} -> ${currentKey}`);
                }
              } else {
                // 状态未变化，直接更新数据（如统计信息）
                setCampaigns(prevCampaigns =>
                  prevCampaigns.map(c =>
                    c.id === campaign.id ? { ...c, ...newCampaign } : c
                  )
                );
                // 重置计数器
                statusChangeCounters.delete(campaign.id);
                
                // 记录轮询更新日志
                if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
                  campaignLogger.logPolling(campaign.id, {
                    action: 'POLLING_UPDATE',
                    status: newCampaign.status,
                    isRunning: newCampaign.isRunning,
                    sentCount: newCampaign.sentCount,
                    totalRecipients: newCampaign.totalRecipients
                  }, 'FRONTEND_POLLING');
                }
              }
            }
          })
          .catch(error => console.error(`获取活动 ${campaign.id} 状态失败:`, error));
      });
    }, 5000); // 每5秒轮询一次

    return () => clearInterval(interval);
  }, [campaigns]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (statusFilter) {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/campaigns?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.campaigns) {
        setCampaigns(data.campaigns)
        setPagination(data.pagination)
      } else {
        console.warn('API响应中没有campaigns数据:', data)
        setCampaigns([])
      }
    } catch (error) {
      console.error('获取活动列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 检查待处理任务
  const checkPendingTasks = async () => {
    try {
      const response = await fetch('/api/manual-trigger')
      if (response.ok) {
        const data = await response.json()
        // 使用新的队列统计信息
        const queueStats = data.queueStats || {}
        const pendingCount = (queueStats.campaigns || []).length + (queueStats.queueSize || 0)
        setPendingTasks(pendingCount)
      } else {
        console.warn(`检查待处理任务API返回错误: ${response.status}`)
        setPendingTasks(0)
      }
    } catch (error) {
      console.error('检查待处理任务失败:', error)
      setPendingTasks(0)
    }
  }

  // 手动触发定时任务
  const handleManualTrigger = async () => {
    if (isTriggering) return
    
    try {
      setIsTriggering(true)
      const response = await fetch('/api/manual-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        alert(data.message || '定时任务已触发')
        // 刷新待处理任务数量
        await checkPendingTasks()
        // 刷新活动列表
        await fetchCampaigns()
      } else {
        alert(data.error || '触发失败')
      }
    } catch (error) {
      console.error('手动触发失败:', error)
      alert('触发失败，请重试')
    } finally {
      setIsTriggering(false)
    }
  }

  const handleStartCampaign = async (campaignId: string) => {
    if (!confirm('确定要开始执行这个活动吗？活动将在后台持续运行，即使关闭页面也会继续发送。')) {
      return
    }

    try {
      console.log('正在启动活动:', campaignId)
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('响应状态:', response.status)
      const data = await response.json()
      console.log('响应数据:', data)

      if (response.ok && data.success) {
        alert('活动已开始执行，将在后台持续发送邮件')
        fetchCampaigns()
      } else {
        const errorMsg = data.error || `启动失败 (状态码: ${response.status})`
        console.error('启动失败:', errorMsg)
        alert(errorMsg)
      }
    } catch (error) {
      console.error('启动活动失败:', error)
      alert(`启动失败，请重试。错误: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handlePauseCampaign = async (campaignId: string) => {
    if (!confirm('确定要暂停这个活动吗？')) {
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'pause' })
      })

      const data = await response.json()

      if (data.success) {
        alert('活动已暂停')
        fetchCampaigns()
      } else {
        alert(data.error || '暂停失败')
      }
    } catch (error) {
      console.error('暂停活动失败:', error)
      alert('暂停失败，请重试')
    }
  }

  // 恢复暂停的活动
  const handleResumeCampaign = async (campaignId: string) => {
    if (!confirm('确定要恢复这个暂停的活动吗？')) {
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'resume' })
      })

      const data = await response.json()

      if (data.success) {
        alert('活动已恢复')
        fetchCampaigns()
      } else {
        alert(data.error || '恢复失败')
      }
    } catch (error) {
      console.error('恢复活动失败:', error)
      alert('恢复失败，请重试')
    }
  }

  // 继续发送状态为SENDING但队列未运行的活动
  const handleContinueSending = async (campaignId: string) => {
    if (!confirm('确定要继续发送这个活动吗？')) {
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/continue-sending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (data.success) {
        alert('活动已继续发送')
        fetchCampaigns()
      } else {
        alert(data.error || '继续发送失败')
      }
    } catch (error) {
      console.error('继续发送活动失败:', error)
      alert('继续发送失败，请重试')
    }
  }

  // 恢复队列
  const handleRecoverQueue = async (campaignId: string) => {
    if (!confirm('确定要恢复这个活动的队列吗？这将重新初始化队列状态。')) {
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (data.success) {
        alert('队列恢复成功')
        fetchCampaigns()
      } else {
        alert(data.error || '队列恢复失败')
      }
    } catch (error) {
      console.error('队列恢复失败:', error)
      alert('队列恢复失败，请重试')
    }
  }

  const handleStopCampaign = async (campaignId: string) => {
    if (!confirm('确定要停止这个活动吗？停止后可以重新启动或删除活动。')) {
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'stop' })
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message || '活动已停止，现在可以重新启动或删除')
        fetchCampaigns()
      } else {
        alert(data.error || '停止失败')
      }
    } catch (error) {
      console.error('停止活动失败:', error)
      alert('停止失败，请重试')
    }
  }

  const handleRetryCampaign = async (campaignId: string) => {
    if (!confirm('确定要重试这个失败的活动吗？将重新发送失败的邮件。')) {
      return
    }

    try {
      // 首先将活动状态重置为草稿
      const resetResponse = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: CampaignStatus.DRAFT })
      })

      const resetData = await resetResponse.json()

      if (resetData.success) {
        // 然后重新启动活动
        await handleStartCampaign(campaignId)
      } else {
        alert(resetData.error || '重试失败')
      }
    } catch (error) {
      console.error('重试活动失败:', error)
      alert('重试失败，请重试')
    }
  }

  const handleResendCampaign = async (campaignId: string) => {
    if (!confirm('确定要重新发送这个活动吗？这将清除所有发送记录并从头开始发送给所有收件人。')) {
      return
    }

    try {
      console.log('正在重新发送活动:', campaignId)
      const response = await fetch(`/api/campaigns/${campaignId}/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('响应状态:', response.status)
      const data = await response.json()
      console.log('响应数据:', data)

      if (response.ok && data.success) {
        alert('活动已开始重新发送，将从头开始发送给所有收件人')
        fetchCampaigns()
      } else {
        const errorMsg = data.error || `重新发送失败 (状态码: ${response.status})`
        console.error('重新发送失败:', errorMsg)
        alert(errorMsg)
      }
    } catch (error) {
      console.error('重新发送活动失败:', error)
      alert(`重新发送失败，请重试。错误: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('确定要删除这个活动吗？此操作不可恢复。')) {
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        alert('活动已删除')
        fetchCampaigns()
      } else {
        alert(data.error || '删除失败')
      }
    } catch (error) {
      console.error('删除活动失败:', error)
      alert('删除失败，请重试')
    }
  }

  // 批量删除已完成的活动
  const handleBatchDelete = async () => {
    const completedCampaigns = selectedCampaigns.filter(id => {
      const campaign = campaigns.find(c => c.id === id)
      return campaign?.status === CampaignStatus.COMPLETED
    })

    if (completedCampaigns.length === 0) {
      alert('请选择已完成的活动进行删除')
      return
    }

    if (!confirm(`确定要删除 ${completedCampaigns.length} 个已完成的活动吗？`)) {
      return
    }

    setIsDeleting(true)
    try {
      const deletePromises = completedCampaigns.map(id => 
        fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      )
      
      const results = await Promise.allSettled(deletePromises)
      const failedCount = results.filter(result => result.status === 'rejected').length
      
      if (failedCount > 0) {
        alert(`删除完成，其中 ${failedCount} 个活动删除失败`)
      } else {
        alert(`成功删除 ${completedCampaigns.length} 个活动`)
      }
      
      setSelectedCampaigns([])
      fetchCampaigns()
    } catch (error) {
      console.error('批量删除失败:', error)
      alert('批量删除失败')
    } finally {
      setIsDeleting(false)
    }
  }

  // 处理单个选择框
  const handleSelectCampaign = (campaignId: string) => {
    setSelectedCampaigns(prev => 
      prev.includes(campaignId) 
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    )
  }

  // 处理全选
  const handleSelectAll = () => {
    const completedCampaignIds = campaigns
      .filter(campaign => campaign.status === CampaignStatus.COMPLETED)
      .map(campaign => campaign.id)
    
    if (selectedCampaigns.length === completedCampaignIds.length) {
      setSelectedCampaigns([])
    } else {
      setSelectedCampaigns(completedCampaignIds)
    }
  }

  // 获取已完成的活动数量
  const completedCampaigns = campaigns.filter(campaign => campaign.status === CampaignStatus.COMPLETED)
  const selectedCompletedCount = selectedCampaigns.filter(id => {
    const campaign = campaigns.find(c => c.id === id)
    return campaign?.status === CampaignStatus.COMPLETED
  }).length





  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'DRAFT': '草稿',
      'SCHEDULED': '已调度',
      'SENDING': '发送中',
      'PAUSED': '已暂停',
      'STOPPED': '已停止',
      'COMPLETED': '已完成',
      'FAILED': '失败'
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'DRAFT': 'bg-gray-100 text-gray-800',
      'SCHEDULED': 'bg-yellow-100 text-yellow-800',
      'SENDING': 'bg-blue-100 text-blue-800',
      'PAUSED': 'bg-orange-100 text-orange-800',
      'STOPPED': 'bg-red-100 text-red-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'FAILED': 'bg-red-100 text-red-800'
    }
    return colorMap[status] || 'bg-gray-100 text-gray-800'
  }

  // 查看实时日志
  const handleViewLogs = async (campaignId: string) => {
    setSelectedCampaignId(campaignId)
    setShowLogModal(true)
    setLogs(['正在加载实时日志...'])
    
    // 开始实时日志获取
    await fetchRealtimeLogs(campaignId)
  }
  
  // 使用useEffect管理实时日志的自动刷新
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (showLogModal && selectedCampaignId) {
      // 设置定时刷新（每3秒刷新一次）
      interval = setInterval(() => {
        fetchRealtimeLogs(selectedCampaignId)
      }, 3000)
      
      setLogRefreshInterval(interval)
    }
    
    return () => {
      if (interval) {
        clearInterval(interval)
        setLogRefreshInterval(null)
      }
    }
  }, [showLogModal, selectedCampaignId])
  
  const fetchRealtimeLogs = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/realtime-logs`)
      if (response.ok) {
        const data = await response.json()
        
        // 格式化日志显示
        const formattedLogs = data.logs.map((log: any) => {
          const levelIcon: Record<string, string> = {
            'info': '📝',
            'warning': '⚠️',
            'error': '❌',
            'success': '✅'
          }
          const icon = levelIcon[log.level] || '📝'
          
          return `[${log.formattedTime}] ${icon} ${log.message}`
        })
        
        // 添加进度信息
        if (data.progress) {
          const progressInfo = [
            ``,
            `📊 === 发送进度 ===`,
            `总数: ${data.progress.total} | 已发送: ${data.progress.sent} | 失败: ${data.progress.failed} | 待发送: ${data.progress.pending}`,
            `进度: ${data.progress.percentage}% (${data.progress.sent}/${data.progress.total})`,
            ``,
            `⚡ === 发送速率 ===`,
            `最近5分钟: ${data.sendingRate.emailsPer5Min} 封`,
            `预估每小时: ${data.sendingRate.emailsPerHour} 封`,
            ``,
            `🔄 === 队列状态 ===`,
            `当前活动待处理: ${data.queueStats.campaignPending} 个任务`,
            `全局队列待处理: ${data.queueStats.totalPending} 个任务`,
            `全局队列处理中: ${data.queueStats.totalProcessing} 个任务`,
            ``,
            `📋 === 详细日志 ===`
          ]
          
          setLogs([...progressInfo, ...formattedLogs])
        } else {
          setLogs(formattedLogs.length > 0 ? formattedLogs : ['暂无日志'])
        }
        
        // 更新活动状态信息
        if (data.campaign) {
          setLogCampaignInfo(data.campaign)
        }
      } else {
        setLogs(['获取实时日志失败'])
      }
    } catch (error) {
      console.error('获取实时日志失败:', error)
      setLogs(['获取实时日志失败: ' + error])
    }
  }

  // 关闭日志弹窗
  const handleCloseLogModal = () => {
    setShowLogModal(false)
    setSelectedCampaignId(null)
    setLogs([])
    setLogCampaignInfo(null)
    
    // 清理定时器
    if (logRefreshInterval) {
      clearInterval(logRefreshInterval)
      setLogRefreshInterval(null)
    }
  }

  const getProgressPercentage = (campaign: Campaign) => {
    if (campaign.totalRecipients === 0) return 0
    return Math.round((campaign.sentCount / campaign.totalRecipients) * 100)
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
        {/* 面包屑导航 */}
        <BreadcrumbNav 
          title="发送活动"
          showBackButton={false}
        />
        
        <div className="mb-8 flex justify-between items-center">
          <div>
            <p className="text-gray-600">管理和监控邮件发送活动</p>
          </div>
          <Link
            href="/campaigns/create"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            创建活动
          </Link>
        </div>

        {/* 筛选器 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">状态筛选:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">全部状态</option>
                <option value="DRAFT">草稿</option>
                <option value="SCHEDULED">已调度</option>
                <option value="SENDING">发送中</option>
                <option value="PAUSED">已暂停</option>
                <option value="STOPPED">已停止</option>
                <option value="COMPLETED">已完成</option>
                <option value="FAILED">失败</option>
              </select>
            </div>
            <div className="flex items-center space-x-4">
              {completedCampaigns.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    已选择 {selectedCompletedCount} 个已完成活动
                  </span>
                  <button
                    onClick={handleBatchDelete}
                    disabled={selectedCompletedCount === 0 || isDeleting}
                    className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                  >
                    {isDeleting ? '删除中...' : '批量删除'}
                  </button>
                </div>
              )}
              <button
                onClick={handleManualTrigger}
                disabled={isTriggering}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>
                  {isTriggering ? '处理中...' : 
                   pendingTasks > 0 ? `处理定时任务 (${pendingTasks})` : '手动触发定时任务'}
                </span>
              </button>
              <button
                onClick={fetchCampaigns}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{loading ? '刷新中...' : '刷新状态'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 活动列表 */}
        <div className="bg-white rounded-lg shadow-md">
          {loading ? (
            <div className="p-6 text-center">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-gray-500">暂无活动记录</div>
              <Link
                href="/campaigns/create"
                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                创建第一个活动
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={completedCampaigns.length > 0 && selectedCampaigns.length === completedCampaigns.length}
                          onChange={handleSelectAll}
                          className="mr-2"
                          disabled={completedCampaigns.length === 0}
                        />
                        <span>选择</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      活动名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      模板
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      发件人
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      进度
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      创建时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedCampaigns.includes(campaign.id)}
                          onChange={() => handleSelectCampaign(campaign.id)}
                          disabled={campaign.status !== 'COMPLETED'}
                          className="mr-2"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {campaign.name}
                          </div>
                          {campaign.excelUpload && (
                            <div className="text-xs text-gray-500">
                              数据源: {campaign.excelUpload.originalName}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{campaign.template.name}</div>
                        <div className="text-xs text-gray-500">{campaign.template.subject}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{campaign.emailProfile.nickname}</div>
                        <div className="text-xs text-gray-500">{campaign.emailProfile.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                          {getStatusText(campaign.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {campaign.sentCount}/{campaign.totalRecipients}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${getProgressPercentage(campaign)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {getProgressPercentage(campaign)}%
                          {campaign.failedCount > 0 && (
                            <span className="text-red-500 ml-2">
                              失败: {campaign.failedCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(campaign.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewLogs(campaign.id)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="查看实时日志"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          
                          {campaign.status === CampaignStatus.DRAFT && (
                            <>
                              <button
                                onClick={() => handleStartCampaign(campaign.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                启动
                              </button>
                              <Link
                                href={`/campaigns/${campaign.id}/edit`}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="编辑活动"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Link>
                              <button
                                onClick={() => handleDeleteCampaign(campaign.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                删除
                              </button>
                            </>
                          )}
                          
                          {campaign.status === CampaignStatus.SCHEDULED && (
                            <>
                              <button
                                onClick={() => handlePauseCampaign(campaign.id)}
                                className="text-yellow-600 hover:text-yellow-900"
                              >
                                暂停
                              </button>
                              <button
                                onClick={() => handleStopCampaign(campaign.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                停止
                              </button>
                              <Link
                                href={`/campaigns/${campaign.id}/edit`}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="编辑活动"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Link>
                            </>
                          )}
                          
                          {campaign.status === CampaignStatus.SENDING && (
                            <>
                              {campaign.isRunning && (
                                <button
                                  onClick={() => handlePauseCampaign(campaign.id)}
                                  className="text-yellow-600 hover:text-yellow-900"
                                >
                                  暂停
                                </button>
                              )}
                              <button
                                onClick={() => handleStopCampaign(campaign.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                停止
                              </button>
                              <button
                                onClick={() => handleRecoverQueue(campaign.id)}
                                className="text-blue-600 hover:text-blue-900"
                                title="恢复异常队列"
                              >
                                恢复队列
                              </button>
                            </>
                          )}
                          
                          {campaign.status === CampaignStatus.PAUSED && (
                            <>
                              <button
                                onClick={() => handleResumeCampaign(campaign.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                恢复发送
                              </button>
                              <Link
                                href={`/campaigns/${campaign.id}/edit`}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="编辑活动"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Link>
                            </>
                          )}
                          
                          {campaign.status === CampaignStatus.FAILED && (
                            <>
                              <button
                                onClick={() => handleRetryCampaign(campaign.id)}
                                className="text-orange-600 hover:text-orange-900"
                              >
                                重试
                              </button>
                              <button
                                onClick={() => handleResendCampaign(campaign.id)}
                                className="text-purple-600 hover:text-purple-900"
                              >
                                重新发送
                              </button>
                              <button
                                onClick={() => handleDeleteCampaign(campaign.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                删除
                              </button>
                            </>
                          )}

                          {campaign.status === CampaignStatus.STOPPED && (
                            <>
                              <button
                                onClick={() => handleContinueSending(campaign.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                继续发送
                              </button>
                              <button
                                onClick={() => handleResendCampaign(campaign.id)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                重新发送
                              </button>
                              <Link
                                href={`/campaigns/${campaign.id}/edit`}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="编辑活动"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Link>
                              <button
                                onClick={() => handleDeleteCampaign(campaign.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                删除
                              </button>
                            </>
                          )}

                          {campaign.status === CampaignStatus.COMPLETED && (
                            <>
                              <button
                                onClick={() => handleResendCampaign(campaign.id)}
                                className="text-purple-600 hover:text-purple-900"
                              >
                                重新发送
                              </button>
                              <button
                                onClick={() => handleDeleteCampaign(campaign.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                删除
                              </button>
                            </>
                          )}


                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 分页 */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  显示 {((pagination.page - 1) * pagination.limit) + 1} 到{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} 条，
                  共 {pagination.total} 条记录
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.pages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 实时日志弹窗 */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-medium text-gray-900">
                  实时日志监控
                </h3>
                {logCampaignInfo && (
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      logCampaignInfo.status === CampaignStatus.SENDING ? 'bg-blue-100 text-blue-800' :
                      logCampaignInfo.status === CampaignStatus.COMPLETED ? 'bg-green-100 text-green-800' :
                      logCampaignInfo.status === CampaignStatus.PAUSED ? 'bg-yellow-100 text-yellow-800' :
                      logCampaignInfo.status === CampaignStatus.FAILED ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {logCampaignInfo.status === CampaignStatus.SENDING ? '发送中' :
                       logCampaignInfo.status === CampaignStatus.COMPLETED ? '已完成' :
                       logCampaignInfo.status === CampaignStatus.PAUSED ? '已暂停' :
                       logCampaignInfo.status === CampaignStatus.FAILED ? '失败' :
                       logCampaignInfo.status}
                    </span>
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>实时更新</span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleCloseLogModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 p-6 overflow-auto">
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-auto">
                <div className="whitespace-pre-wrap">
                  {logs.length > 0 ? logs.join('\n') : '正在加载日志...'}
                </div>
                {/* 自动滚动到底部 */}
                <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
              </div>
            </div>
            <div className="flex justify-between items-center p-6 border-t text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span>📊 每3秒自动刷新</span>
                <span>🔄 实时监控队列状态</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => selectedCampaignId && fetchRealtimeLogs(selectedCampaignId)}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  手动刷新
                </button>
                <button
                  onClick={handleCloseLogModal}
                  className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
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