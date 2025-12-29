'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Search, Trash2, Ban, CheckCircle, RefreshCw } from 'lucide-react'
import { EmailStatus } from '@prisma/client'

interface FailedEmail {
  id: string
  recipientEmail: string
  recipientName: string
  status: string // 支持字符串类型，因为数据库中存储的是小写字符串
  errorMessage: string
  sentAt: string
  campaign: {
    id: string
    name: string
  }
  recipient: {
    id: string
    email: string
    name: string
    isBlacklisted: boolean
    failureCount: number
    bounceCount: number
    lastFailureReason: string
  }
  emailProfile: {
    id: string
    email: string
    name: string
  }
}

interface FailedEmailsData {
  failedEmails: FailedEmail[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats: {
    total: number
    failed: number
    bounced: number
    rejected: number
    invalid: number
    blacklisted: number
  }
}

// 支持小写状态值（数据库中存储的格式）
const statusLabels: Record<string, string> = {
  'failed': '发送失败',
  'bounced': '邮件退回',
  'rejected': '被拒收',
  'invalid': '无效邮箱',
  'blacklisted': '黑名单',
  'sent': '发送成功',
  'delivered': '已送达',
  'opened': '已打开',
  'clicked': '已点击',
  'success': '发送成功',
  'unknown': '未知状态',
  // 兼容大写格式
  [EmailStatus.FAILED]: '发送失败',
  [EmailStatus.BOUNCED]: '邮件退回',
  [EmailStatus.REJECTED]: '被拒收',
  [EmailStatus.INVALID]: '无效邮箱',
  [EmailStatus.BLACKLISTED]: '黑名单',
  [EmailStatus.SUCCESS]: '发送成功',
  [EmailStatus.UNKNOWN]: '未知状态'
}

const statusColors: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
  'failed': 'destructive',
  'bounced': 'secondary',
  'rejected': 'outline',
  'invalid': 'destructive',
  'blacklisted': 'default',
  'sent': 'default',
  'delivered': 'default',
  'opened': 'default',
  'clicked': 'default',
  'success': 'default',
  'unknown': 'secondary',
  // 兼容大写格式
  [EmailStatus.FAILED]: 'destructive',
  [EmailStatus.BOUNCED]: 'secondary',
  [EmailStatus.REJECTED]: 'outline',
  [EmailStatus.INVALID]: 'destructive',
  [EmailStatus.BLACKLISTED]: 'default',
  [EmailStatus.UNKNOWN]: 'secondary',
  [EmailStatus.SUCCESS]: 'default'
}

export default function FailedEmailsPage() {
  const { data: session, status } = useSession()
  const [data, setData] = useState<FailedEmailsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: 'all',
    search: '',
    campaignId: ''
  })

  const fetchFailedEmails = async () => {
    // 简化会话检查 - 不强制要求登录
    if (status === 'loading') return
    
    try {
      setLoading(true)
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })
      
      const response = await fetch(`/api/failed-emails?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        toast.error(result.error || '获取失败邮箱列表失败')
      }
    } catch (error) {
      console.error('获取失败邮箱列表失败:', error)
      toast.error('获取失败邮箱列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 简化加载逻辑 - 不等待会话
    if (status !== 'loading') {
      fetchFailedEmails()
    }
  }, [filters, status])

  const handleSelectEmail = (emailId: string, recipientId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmails(prev => [...prev, emailId])
      setSelectedRecipients(prev => [...prev, recipientId])
    } else {
      setSelectedEmails(prev => prev.filter(id => id !== emailId))
      setSelectedRecipients(prev => prev.filter(id => id !== recipientId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked && data) {
      setSelectedEmails(data.failedEmails.map(email => email.id))
      setSelectedRecipients(data.failedEmails.map(email => email.recipient.id))
    } else {
      setSelectedEmails([])
      setSelectedRecipients([])
    }
  }

  const handleBatchAction = async (action: string) => {
    if (selectedEmails.length === 0) {
      toast.error('请选择要操作的邮件')
      return
    }

    try {
      const response = await fetch('/api/failed-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          emailIds: selectedEmails,
          recipientIds: selectedRecipients
        })
      })

      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message || '操作完成')
        setSelectedEmails([])
        setSelectedRecipients([])
        fetchFailedEmails()
      } else {
        toast.error(result.error || '操作失败')
      }
    } catch (error) {
      console.error('批量操作失败:', error)
      toast.error('操作失败')
    }
  }

  // 如果正在加载会话，显示加载状态
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>正在加载...</p>
        </div>
      </div>
    )
  }

  // 如果用户未登录，显示登录提示
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">需要登录</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">请先登录以查看失败邮件管理页面。</p>
          <a href="/auth/signin" className="text-blue-600 hover:text-blue-800">前往登录</a>
        </div>
      </div>
    )
  }

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }))
  }

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status, page: 1 }))
  }

  if (loading && !data) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">失败邮箱管理</h1>
        <Button onClick={fetchFailedEmails} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{data.stats.total}</div>
              <div className="text-sm text-muted-foreground">总失败数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{data.stats.failed}</div>
              <div className="text-sm text-muted-foreground">发送失败</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{data.stats.bounced}</div>
              <div className="text-sm text-muted-foreground">邮件退回</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{data.stats.rejected}</div>
              <div className="text-sm text-muted-foreground">被拒收</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{data.stats.invalid}</div>
              <div className="text-sm text-muted-foreground">无效邮箱</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-600">{data.stats.blacklisted}</div>
              <div className="text-sm text-muted-foreground">黑名单</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 筛选和搜索 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索邮箱地址或收件人姓名..."
                  value={filters.search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filters.status} onValueChange={handleStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                <SelectItem value={EmailStatus.FAILED}>发送失败</SelectItem>
                <SelectItem value={EmailStatus.BOUNCED}>邮件退回</SelectItem>
                <SelectItem value={EmailStatus.REJECTED}>被拒收</SelectItem>
                <SelectItem value={EmailStatus.INVALID}>无效邮箱</SelectItem>
                <SelectItem value={EmailStatus.BLACKLISTED}>黑名单</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作 */}
      {selectedEmails.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                已选择 {selectedEmails.length} 项
              </span>
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Ban className="h-4 w-4 mr-2" />
                      加入黑名单
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认加入黑名单</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要将选中的 {selectedRecipients.length} 个收件人加入黑名单吗？
                        加入黑名单后，这些邮箱将不会再收到任何邮件。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBatchAction('blacklist')}>
                        确认
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      移出黑名单
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认移出黑名单</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要将选中的 {selectedRecipients.length} 个收件人移出黑名单吗？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBatchAction('unblacklist')}>
                        确认
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除记录
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除选中的 {selectedEmails.length} 条失败邮件记录吗？
                        此操作不可撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBatchAction('delete')}>
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 邮件列表 */}
      <Card>
        <CardHeader>
          <CardTitle>失败邮件列表</CardTitle>
        </CardHeader>
        <CardContent>
          {data && data.failedEmails.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedEmails.length === data.failedEmails.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>收件人</TableHead>
                    <TableHead>邮箱地址</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>活动名称</TableHead>
                    <TableHead>发送账户</TableHead>
                    <TableHead>失败原因</TableHead>
                    <TableHead>失败时间</TableHead>
                    <TableHead>失败次数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.failedEmails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEmails.includes(email.id)}
                          onCheckedChange={(checked) => 
                            handleSelectEmail(email.id, email.recipient.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{email.recipientName}</span>
                          {email.recipient.isBlacklisted && (
                            <Badge variant="destructive" className="w-fit mt-1">
                              黑名单
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {email.recipientEmail}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[email.status]}>
                          {statusLabels[email.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{email.campaign.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{email.emailProfile.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {email.emailProfile.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={email.errorMessage}>
                          {email.errorMessage || email.recipient.lastFailureReason || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(email.sentAt).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span>失败: {email.recipient.failureCount}</span>
                          <span>退回: {email.recipient.bounceCount}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分页 */}
              {data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    显示 {(data.pagination.page - 1) * data.pagination.limit + 1} 到{' '}
                    {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} 条，
                    共 {data.pagination.total} 条记录
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.pagination.page <= 1}
                      onClick={() => handlePageChange(data.pagination.page - 1)}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.pagination.page >= data.pagination.totalPages}
                      onClick={() => handlePageChange(data.pagination.page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无失败邮件记录
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}