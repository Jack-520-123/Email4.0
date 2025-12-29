'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle, Clock, Mail, Pause, Play, Square } from 'lucide-react'
import { toast } from 'sonner'

interface Campaign {
  id: string
  name: string
  status: string
  sentCount: number
  failedCount: number
  scheduledAt: string | null
  lastSentAt: string | null
  isRunning: boolean
}

interface SendingStatusMonitorProps {
  campaignId: string
  onStatusChange?: (status: string) => void
}

export function SendingStatusMonitor({ campaignId, onStatusChange }: SendingStatusMonitorProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalRecipients, setTotalRecipients] = useState(0)

  // 获取活动状态
  const fetchCampaignStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/continue-sending`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON')
      }
      const data = await response.json()
      if (data.success) {
        setCampaign(data.campaign)
        onStatusChange?.(data.campaign.status)
        setError(null)
      } else {
        setError(data.error || '获取状态失败')
      }
    } catch (err) {
      console.error('Status fetch error:', err)
      setError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setLoading(false)
    }
  }, [campaignId, onStatusChange])

  // 获取收件人总数
  const fetchTotalRecipients = useCallback(async () => {
    try {
      // 使用专门的收件人数量API，它会考虑selectedGroups等配置
      const response = await fetch(`/api/campaigns/${campaignId}/recipients-count`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setTotalRecipients(data.count || 0)
        }
      } else {
        // 如果专门的API失败，回退到原来的方法
        const fallbackResponse = await fetch(`/api/campaigns/${campaignId}`)
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          if (fallbackData.success && fallbackData.campaign) {
            // 计算总收件人数
            let total = 0
            if (fallbackData.campaign.excelUpload?.data) {
              total = Array.isArray(fallbackData.campaign.excelUpload.data) ? fallbackData.campaign.excelUpload.data.length : 0
            } else if (fallbackData.campaign.recipientList?.recipients) {
              total = fallbackData.campaign.recipientList.recipients.length
            }
            setTotalRecipients(total)
          }
        }
      }
    } catch (err) {
      console.error('获取收件人总数失败:', err)
    }
  }, [campaignId])

  // 恢复发送
  const handleContinueSending = async () => {
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
        toast.success('活动已恢复发送')
        fetchCampaignStatus()
      } else {
        toast.error(data.error || '恢复失败')
      }
    } catch (err) {
      toast.error('网络错误')
    }
  }

  // 重新发送
  const handleResendCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/resend`, {
        method: 'POST'
      })
      
      const data = await response.json()
      if (data.success) {
        toast.success(data.message)
        fetchCampaignStatus()
      } else {
        toast.error(data.error || '重新发送失败')
      }
    } catch (err) {
      toast.error('网络错误')
    }
  }

  // 暂停发送
  const handlePauseSending = async () => {
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
        toast.success('已暂停发送')
        fetchCampaignStatus()
      } else {
        toast.error(data.error || '暂停失败')
      }
    } catch (err) {
      toast.error('网络错误')
    }
  }

  // 停止发送
  const handleStopSending = async () => {
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
        toast.success('已停止发送')
        fetchCampaignStatus()
      } else {
        toast.error(data.error || '停止失败')
      }
    } catch (err) {
      toast.error('网络错误')
    }
  }

  // 初始化数据
  useEffect(() => {
    fetchCampaignStatus()
    fetchTotalRecipients()
  }, [fetchCampaignStatus, fetchTotalRecipients])

  // 智能刷新状态 - 只在真正需要时刷新
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    // 只有在真正发送中且未暂停时才需要频繁刷新
    const needsFrequentRefresh = (
      campaign?.status === 'SENDING' && 
      !campaign?.scheduledAt && // 没有定时发送
      campaign?.isRunning
    );
    
    if (needsFrequentRefresh) {
      // 发送中时每10秒刷新一次（降低频率）
      interval = setInterval(() => {
        fetchCampaignStatus()
      }, 10000)
    } else if (campaign?.status === 'SENDING' && campaign?.scheduledAt) {
      // 定时发送状态时每30秒检查一次
      interval = setInterval(() => {
        fetchCampaignStatus()
      }, 30000)
    }
    // 其他状态不需要自动刷新

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [campaign?.status, campaign?.scheduledAt, campaign?.isRunning, fetchCampaignStatus])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">加载中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!campaign) {
    return null
  }

  const progress = totalRecipients > 0 ? (campaign.sentCount / totalRecipients) * 100 : 0
  const isActive = campaign.status === 'SENDING' && campaign.isRunning
  const isPaused = campaign.status === 'PAUSED'
  const isCompleted = campaign.status === 'COMPLETED'
  const isFailed = campaign.status === 'FAILED'
  const isStopped = campaign.status === 'STOPPED'

  const getStatusBadge = () => {
    if (isActive) {
      return <Badge className="bg-green-100 text-green-800"><Mail className="h-3 w-3 mr-1" />发送中</Badge>
    } else if (isPaused) {
      return <Badge className="bg-yellow-100 text-yellow-800"><Pause className="h-3 w-3 mr-1" />已暂停</Badge>
    } else if (isCompleted) {
      return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="h-3 w-3 mr-1" />已完成</Badge>
    } else if (isFailed) {
      return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />发送失败</Badge>
    } else if (isStopped) {
      return <Badge className="bg-gray-100 text-gray-800"><Square className="h-3 w-3 mr-1" />已停止</Badge>
    } else if (campaign.scheduledAt) {
      return <Badge className="bg-purple-100 text-purple-800"><Clock className="h-3 w-3 mr-1" />等待发送</Badge>
    }
    return <Badge variant="outline">{campaign.status}</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{campaign.name}</CardTitle>
            <CardDescription>邮件发送状态监控</CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>发送进度</span>
            <span>{campaign.sentCount} / {totalRecipients}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-gray-500 text-center">
            {progress.toFixed(1)}% 完成
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">成功发送:</span>
            <span className="font-medium text-green-600">{campaign.sentCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">发送失败:</span>
            <span className="font-medium text-red-600">{campaign.failedCount}</span>
          </div>
        </div>

        {/* 时间信息 */}
        {campaign.lastSentAt && (
          <div className="text-xs text-gray-500">
            最后发送时间: {new Date(campaign.lastSentAt).toLocaleString('zh-CN')}
          </div>
        )}

        {campaign.scheduledAt && (
          <div className="text-xs text-purple-600">
            下次发送时间: {new Date(campaign.scheduledAt).toLocaleString('zh-CN')}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          {!isActive && (isPaused || (campaign.status === 'SENDING' && campaign.scheduledAt)) && (
            <Button 
              onClick={handleContinueSending}
              size="sm"
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-1" />
              恢复发送
            </Button>
          )}
          
          {isStopped && (
            <>
              <Button 
                onClick={handleContinueSending}
                size="sm"
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-1" />
                恢复发送
              </Button>
              <Button 
                onClick={handleResendCampaign}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Mail className="h-4 w-4 mr-1" />
                重新发送
              </Button>
            </>
          )}
          
          {isActive && (
            <>
              <Button 
                onClick={handlePauseSending}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Pause className="h-4 w-4 mr-1" />
                暂停
              </Button>
              <Button 
                onClick={handleStopSending}
                variant="destructive"
                size="sm"
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-1" />
                停止
              </Button>
            </>
          )}
        </div>

        {/* 智能发送策略说明 */}
        {isActive && (
          <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
            <div className="font-medium mb-1">智能发送策略</div>
            <div>• 短间隔(&lt;2分钟): 连续发送</div>
            <div>• 中间隔(2-10分钟): 自动递归调用</div>
            <div>• 长间隔(&gt;10分钟): 定时发送</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}