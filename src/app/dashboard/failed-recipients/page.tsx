'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Download, RefreshCw, Trash2, UserX, UserCheck, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface FailedRecipient {
  id: string
  name: string
  email: string
  company?: string
  group?: string
  recipientList?: string
  emailStatus: string
  successCount: number
  failureCount: number
  bounceCount: number
  isBlacklisted: boolean
  lastSentAt?: string
  senderNickname?: string
  senderEmail?: string
  lastFailureReason?: string
  lastError?: string
  lastErrorTime?: string
}

interface Stats {
  failed?: number
  bounced?: number
  rejected?: number
  invalid?: number
  blacklisted?: number
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function FailedRecipientsPage() {
  const [recipients, setRecipients] = useState<FailedRecipient[]>([])
  const [stats, setStats] = useState<Stats>({})
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchFailedRecipients = async (page = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        status: statusFilter
      })

      if (searchTerm) {
        params.append('search', searchTerm)
      }

      const response = await fetch(`/api/recipients/failed?${params}`)
      const data = await response.json()

      if (data.success) {
        setRecipients(data.data.recipients)
        setStats(data.data.stats)
        setPagination(data.data.pagination)
      } else {
        toast.error(data.error || '获取失败收件人列表失败')
      }
    } catch (error) {
      console.error('获取失败收件人列表失败:', error)
      toast.error('获取失败收件人列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        export: 'csv',
        status: statusFilter
      })

      if (searchTerm) {
        params.append('search', searchTerm)
      }

      const response = await fetch(`/api/recipients/failed?${params}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `failed-recipients-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('导出成功')
      } else {
        toast.error('导出失败')
      }
    } catch (error) {
      console.error('导出失败:', error)
      toast.error('导出失败')
    }
  }

  const handleBatchAction = async (action: string) => {
    if (selectedIds.length === 0) {
      toast.error('请选择要操作的收件人')
      return
    }

    try {
      const response = await fetch('/api/recipients/failed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientIds: selectedIds,
          action
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`成功操作 ${data.updatedCount} 个收件人`)
        setSelectedIds([])
        fetchFailedRecipients(pagination.page)
      } else {
        toast.error(data.error || '操作失败')
      }
    } catch (error) {
      console.error('批量操作失败:', error)
      toast.error('操作失败')
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(recipients.map(r => r.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id))
    }
  }

  const getStatusBadge = (status: string, isBlacklisted: boolean) => {
    if (isBlacklisted) {
      return <Badge variant="destructive">黑名单</Badge>
    }

    switch (status) {
      case 'FAILED':
        return <Badge variant="destructive">发送失败</Badge>
      case 'BOUNCED':
        return <Badge variant="destructive">邮件退回</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">被拒收</Badge>
      case 'INVALID':
        return <Badge variant="destructive">无效邮箱</Badge>
      case 'BLACKLISTED':
        return <Badge variant="destructive">黑名单</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  useEffect(() => {
    fetchFailedRecipients()
  }, [statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== undefined) {
        fetchFailedRecipients(1)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">失败邮箱管理</h1>
          <p className="text-muted-foreground mt-2">
            管理发送失败、被拒收、退回的邮箱地址
          </p>
        </div>
        <Button onClick={handleExport} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          导出CSV
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">发送失败</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">邮件退回</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.bounced || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">被拒收</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.rejected || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">无效邮箱</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.invalid || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">黑名单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.blacklisted || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardHeader>
          <CardTitle>筛选和搜索</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索邮箱地址或姓名..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="FAILED">发送失败</SelectItem>
                <SelectItem value="BOUNCED">邮件退回</SelectItem>
                <SelectItem value="REJECTED">被拒收</SelectItem>
                <SelectItem value="INVALID">无效邮箱</SelectItem>
                <SelectItem value="BLACKLISTED">黑名单</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => fetchFailedRecipients(pagination.page)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作 */}
      {selectedIds.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                已选择 {selectedIds.length} 个收件人
              </span>
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      移出黑名单
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认移出黑名单</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要将选中的 {selectedIds.length} 个收件人移出黑名单吗？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBatchAction('remove_blacklist')}>
                        确认
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <UserX className="h-4 w-4" />
                      加入黑名单
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认加入黑名单</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要将选中的 {selectedIds.length} 个收件人加入黑名单吗？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBatchAction('add_blacklist')}>
                        确认
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      重置状态
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认重置状态</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要重置选中的 {selectedIds.length} 个收件人的状态吗？这将清除所有失败记录和计数。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBatchAction('reset_status')}>
                        确认
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 数据表格 */}
      <Card>
        <CardHeader>
          <CardTitle>失败收件人列表</CardTitle>
          <CardDescription>
            共 {pagination.total} 个失败收件人
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === recipients.length && recipients.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>公司</TableHead>
                    <TableHead>收件人列表</TableHead>
                    <TableHead>发件箱</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>成功/失败/退回</TableHead>
                    <TableHead>最后发送时间</TableHead>
                    <TableHead>失败原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(recipient.id)}
                          onCheckedChange={(checked) => handleSelectOne(recipient.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{recipient.name}</TableCell>
                      <TableCell>{recipient.email}</TableCell>
                      <TableCell>{recipient.company || '-'}</TableCell>
                      <TableCell>{recipient.recipientList || '-'}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{recipient.senderNickname || '-'}</div>
                          <div className="text-muted-foreground text-xs">{recipient.senderEmail || '-'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(recipient.emailStatus, recipient.isBlacklisted)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="text-green-600">{recipient.successCount}</span> / 
                          <span className="text-red-600">{recipient.failureCount}</span> / 
                          <span className="text-orange-600">{recipient.bounceCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {recipient.lastSentAt ? new Date(recipient.lastSentAt).toLocaleString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={recipient.lastFailureReason || recipient.lastError}>
                          {recipient.lastFailureReason || recipient.lastError || '-'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchFailedRecipients(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    第 {pagination.page} 页，共 {pagination.totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchFailedRecipients(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}