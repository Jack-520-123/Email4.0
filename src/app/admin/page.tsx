'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Users, Mail, Settings, TestTube, Plus, Edit, Trash2, BarChart3, Download, Search, CheckCircle2, XCircle, Clock } from 'lucide-react'
import BreadcrumbNav from '@/components/ui/breadcrumb-nav'

interface User {
  id: string
  name: string
  email: string
  role: string
  status: string
  permissions: any
  createdAt: string
  _count: {
    emailProfiles: number
    templates: number
    campaigns: number
  }
}

interface EmailProfile {
  id: string
  nickname: string
  email: string
  emailType: string
  smtpServer: string
  smtpPort: number
  isDefault: boolean
  isSystemAdmin: boolean
  createdAt: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [emailProfiles, setEmailProfiles] = useState<EmailProfile[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editingProfile, setEditingProfile] = useState<EmailProfile | null>(null)
  const [showAddProfile, setShowAddProfile] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [assigningGreetings, setAssigningGreetings] = useState(false)

  // 系统统计数据
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingUsers: 0,
    approvedUsers: 0,
    disabledUsers: 0,
    totalCampaigns: 0,
    activeCampaigns: 0,
    completedCampaigns: 0,
    totalEmailsSent: 0
  })

  // 用户搜索和筛选
  const [userSearch, setUserSearch] = useState('')
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'approved' | 'disabled'>('all')

  // 数据导出
  const [exportUserId, setExportUserId] = useState('')
  const [exportType, setExportType] = useState<'templates' | 'email-profiles' | 'recipients'>('templates')
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')
  const [exporting, setExporting] = useState(false)

  // 新邮箱配置表单
  const [newProfile, setNewProfile] = useState({
    nickname: '',
    email: '',
    password: '',
    emailType: '',
    smtpServer: '',
    smtpPort: '',
    isDefault: false
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetchUsers()
    fetchEmailProfiles()
  }, [session, status, router])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)

        // 计算用户统计数据
        const userStats = data.users.reduce((acc: any, user: User) => {
          acc.totalUsers++
          if (user.status === 'pending') acc.pendingUsers++
          if (user.status === 'approved') acc.approvedUsers++
          if (user.status === 'disabled') acc.disabledUsers++
          acc.totalCampaigns += user._count.campaigns
          return acc
        }, { totalUsers: 0, pendingUsers: 0, approvedUsers: 0, disabledUsers: 0, totalCampaigns: 0 })

        setStats(prev => ({ ...prev, ...userStats }))
      } else {
        toast.error('获取用户列表失败')
      }
    } catch (error) {
      toast.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmailProfiles = async () => {
    try {
      const response = await fetch('/api/admin/email-profiles')
      if (response.ok) {
        const data = await response.json()
        setEmailProfiles(data.profiles)
      } else {
        toast.error('获取邮箱配置失败')
      }
    } catch (error) {
      toast.error('获取邮箱配置失败')
    }
  }

  const updateUserPermissions = async (userId: string, permissions: any, role?: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, permissions, role })
      })

      if (response.ok) {
        toast.success('用户权限更新成功')
        fetchUsers()
        setSelectedUser(null)
      } else {
        toast.error('更新用户权限失败')
      }
    } catch (error) {
      toast.error('更新用户权限失败')
    }
  }

  const updateUserStatus = async (userId: string, status: string) => {
    try {
      // 发送状态更新请求，后端会自动处理权限设置
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          status
        })
      })

      if (response.ok) {
        const result = await response.json();
        console.log('用户状态更新结果:', result);
        toast.success(`用户${status === 'approved' ? '审核通过' : '已拒绝'}`)
        if (status === 'approved') {
          toast.success('已自动分配默认权限')
        }
        fetchUsers()
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('更新用户状态失败:', errorData);
        toast.error(errorData.error || '更新用户状态失败')
      }
    } catch (error) {
      console.error('更新用户状态出错:', error);
      toast.error('更新用户状态失败')
    }
  }

  const createEmailProfile = async () => {
    try {
      const response = await fetch('/api/admin/email-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newProfile)
      })

      if (response.ok) {
        toast.success('邮箱配置创建成功')
        fetchEmailProfiles()
        setShowAddProfile(false)
        setNewProfile({
          nickname: '',
          email: '',
          password: '',
          emailType: '',
          smtpServer: '',
          smtpPort: '',
          isDefault: false
        })
      } else {
        const data = await response.json()
        toast.error(data.error || '创建邮箱配置失败')
      }
    } catch (error) {
      toast.error('创建邮箱配置失败')
    }
  }

  const assignDefaultGreetings = async () => {
    setAssigningGreetings(true)
    try {
      const response = await fetch('/api/admin/assign-greetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`批量分配完成！处理了 ${result.summary.processedUsers} 个用户，跳过 ${result.summary.skippedUsers} 个已有问候语的用户`)
        console.log('分配结果详情:', result.details)
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || '批量分配默认问候语失败')
      }
    } catch (error) {
      console.error('批量分配默认问候语出错:', error)
      toast.error('批量分配默认问候语失败')
    } finally {
      setAssigningGreetings(false)
    }
  }

  const testEmailConnection = async (profileId: string) => {
    if (!testEmail) {
      toast.error('请输入测试邮箱地址')
      return
    }

    setTesting(true)
    try {
      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ profileId, testEmail })
      })

      const data = await response.json()
      if (response.ok) {
        toast.success('邮箱连通性测试成功，测试邮件已发送')
      } else {
        toast.error(data.error || '邮箱连通性测试失败')
      }
    } catch (error) {
      toast.error('邮箱连通性测试失败')
    } finally {
      setTesting(false)
    }
  }

  // 数据导出处理
  const handleExport = async () => {
    if (!exportUserId) {
      toast.error('请选择要导出的用户')
      return
    }

    setExporting(true)
    try {
      const response = await fetch(`/api/admin/export/${exportType}?userId=${exportUserId}&format=${exportFormat}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${exportType}_${exportUserId}.${exportFormat}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('导出成功')
      } else {
        const data = await response.json()
        toast.error(data.error || '导出失败')
      }
    } catch (error) {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 批量审核通过
  const batchApprove = async () => {
    const pendingUserIds = users.filter(u => u.status === 'pending').map(u => u.id)
    if (pendingUserIds.length === 0) {
      toast.info('没有待审核的用户')
      return
    }

    for (const userId of pendingUserIds) {
      await updateUserStatus(userId, 'approved')
    }
    toast.success(`已批量审核通过 ${pendingUserIds.length} 个用户`)
  }

  // 过滤用户列表
  const filteredUsers = users.filter(user => {
    const matchesSearch = !userSearch ||
      user.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email?.toLowerCase().includes(userSearch.toLowerCase())
    const matchesFilter = userFilter === 'all' || user.status === userFilter
    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbNav
        title="系统管理"
        showBackButton={true}
        showHomeButton={true}
        customBackPath="/dashboard"
      />
      <div className="mb-6">
        <p className="text-gray-600">管理用户权限、系统邮箱配置和数据导出</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            系统概览
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            用户管理
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            邮箱配置
          </TabsTrigger>
          <TabsTrigger value="greetings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            问候语管理
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            数据导出
          </TabsTrigger>
        </TabsList>

        {/* 系统概览 Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总用户数</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">系统注册用户</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">待审核</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pendingUsers}</div>
                <p className="text-xs text-muted-foreground">等待审核的用户</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">已启用</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.approvedUsers}</div>
                <p className="text-xs text-muted-foreground">正常使用的用户</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">已停用</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.disabledUsers}</div>
                <p className="text-xs text-muted-foreground">被停用的用户</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>活动统计</CardTitle>
              <CardDescription>邮件发送活动概览</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalCampaigns}</div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">总活动数</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{emailProfiles.length}</div>
                  <p className="text-sm text-green-700 dark:text-green-300">系统邮箱配置</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{users.reduce((sum, u) => sum + u._count.templates, 0)}</div>
                  <p className="text-sm text-purple-700 dark:text-purple-300">用户模板总数</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {stats.pendingUsers > 0 && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
              <CardHeader>
                <CardTitle className="text-yellow-800 dark:text-yellow-200">待处理事项</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-700 dark:text-yellow-300">
                      有 <strong>{stats.pendingUsers}</strong> 个用户等待审核
                    </p>
                  </div>
                  <Button onClick={batchApprove} className="bg-yellow-600 hover:bg-yellow-700">
                    批量审核通过
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>用户列表</CardTitle>
              <CardDescription>管理系统用户和权限分配</CardDescription>
            </CardHeader>
            <CardContent>
              {/* 搜索和筛选工具栏 */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索用户名或邮箱..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={userFilter} onValueChange={(value: any) => setUserFilter(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="筛选状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部用户</SelectItem>
                    <SelectItem value="pending">待审核</SelectItem>
                    <SelectItem value="approved">已启用</SelectItem>
                    <SelectItem value="disabled">已停用</SelectItem>
                  </SelectContent>
                </Select>
                {stats.pendingUsers > 0 && (
                  <Button onClick={batchApprove} variant="outline" className="text-green-600">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    批量审核通过 ({stats.pendingUsers})
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {userSearch || userFilter !== 'all' ? '没有找到匹配的用户' : '暂无用户'}
                  </div>
                ) : filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{user.name}</h3>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? '管理员' : '普通用户'}
                        </Badge>
                        <Badge variant={
                          user.status === 'approved' ? 'default' :
                            user.status === 'pending' ? 'secondary' :
                              user.status === 'disabled' ? 'outline' : 'destructive'
                        }>
                          {user.status === 'approved' ? '已启用' :
                            user.status === 'pending' ? '待审核' :
                              user.status === 'disabled' ? '已停用' : '已拒绝'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{user.email}</p>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>邮箱配置: {user._count.emailProfiles}</span>
                        <span>模板: {user._count.templates}</span>
                        <span>活动: {user._count.campaigns}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {user.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateUserStatus(user.id, 'approved')}
                            className="text-green-600 hover:text-green-700"
                          >
                            审核通过
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateUserStatus(user.id, 'rejected')}
                            className="text-red-600 hover:text-red-700"
                          >
                            拒绝
                          </Button>
                        </>
                      )}
                      {user.status === 'approved' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateUserStatus(user.id, 'disabled')}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          停用
                        </Button>
                      )}
                      {user.status === 'disabled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateUserStatus(user.id, 'approved')}
                          className="text-green-600 hover:text-green-700"
                        >
                          启用
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        编辑权限
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedUser && (
            <Card>
              <CardHeader>
                <CardTitle>编辑用户权限 - {selectedUser.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>用户角色</Label>
                  <Select
                    value={selectedUser.role}
                    onValueChange={(value) => setSelectedUser({ ...selectedUser, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">普通用户</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>权限配置 (JSON格式)</Label>
                  <Textarea
                    value={JSON.stringify(selectedUser.permissions || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const permissions = JSON.parse(e.target.value)
                        setSelectedUser({ ...selectedUser, permissions })
                      } catch (error) {
                        // 忽略JSON解析错误
                      }
                    }}
                    rows={6}
                    placeholder='例如: {"emailTypes": ["qq", "163", "gmail", "outlook", "hotmail", "yahoo", "sina", "sohu", "126", "foxmail", "aliyun", "work.weixin", "exmail.qq"], "maxCampaigns": 10}'
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => updateUserPermissions(selectedUser.id, selectedUser.permissions, selectedUser.role)}
                  >
                    保存更改
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedUser(null)}>
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>系统邮箱配置</CardTitle>
                <CardDescription>管理系统默认邮箱配置，用于系统邮件发送</CardDescription>
              </div>
              <Button onClick={() => setShowAddProfile(true)}>
                <Plus className="h-4 w-4 mr-1" />
                添加配置
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {emailProfiles.map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{profile.nickname}</h3>
                        <Badge variant={profile.emailType === 'qq' ? 'default' : 'secondary'}>
                          {profile.emailType.toUpperCase()}
                        </Badge>
                        {profile.isDefault && (
                          <Badge variant="outline">默认</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{profile.email}</p>
                      <p className="text-xs text-gray-500">
                        {profile.smtpServer}:{profile.smtpPort}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testEmailConnection(profile.id)}
                        disabled={testing}
                      >
                        <TestTube className="h-4 w-4 mr-1" />
                        测试
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {emailProfiles.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <Label className="text-sm font-medium mb-2 block">邮箱连通性测试</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="输入测试邮箱地址"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      type="email"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    点击上方邮箱配置的"测试"按钮，将向此邮箱发送测试邮件
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {showAddProfile && (
            <Card>
              <CardHeader>
                <CardTitle>添加系统邮箱配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>配置名称</Label>
                    <Input
                      value={newProfile.nickname}
                      onChange={(e) => setNewProfile({ ...newProfile, nickname: e.target.value })}
                      placeholder="例如: QQ邮箱配置"
                    />
                  </div>
                  <div>
                    <Label>邮箱地址</Label>
                    <Input
                      value={newProfile.email}
                      onChange={(e) => setNewProfile({ ...newProfile, email: e.target.value })}
                      placeholder="例如: admin@example.com"
                      type="email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>邮箱密码/授权码</Label>
                    <Input
                      value={newProfile.password}
                      onChange={(e) => setNewProfile({ ...newProfile, password: e.target.value })}
                      placeholder="邮箱密码或授权码"
                      type="password"
                    />
                  </div>
                  <div>
                    <Label>邮箱类型</Label>
                    <Select
                      value={newProfile.emailType}
                      onValueChange={(value) => setNewProfile({ ...newProfile, emailType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择邮箱类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qq">QQ邮箱</SelectItem>
                        <SelectItem value="163">163邮箱</SelectItem>
                        <SelectItem value="gmail">Gmail</SelectItem>
                        <SelectItem value="outlook">Outlook</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>SMTP服务器</Label>
                    <Input
                      value={newProfile.smtpServer}
                      onChange={(e) => setNewProfile({ ...newProfile, smtpServer: e.target.value })}
                      placeholder="例如: smtp.qq.com"
                    />
                  </div>
                  <div>
                    <Label>SMTP端口</Label>
                    <Input
                      value={newProfile.smtpPort}
                      onChange={(e) => setNewProfile({ ...newProfile, smtpPort: e.target.value })}
                      placeholder="例如: 587"
                      type="number"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newProfile.isDefault}
                    onCheckedChange={(checked) => setNewProfile({ ...newProfile, isDefault: checked })}
                  />
                  <Label>设为默认配置</Label>
                </div>

                <div className="flex gap-2">
                  <Button onClick={createEmailProfile}>
                    创建配置
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddProfile(false)}>
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="greetings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>问候语管理</CardTitle>
              <CardDescription>为现有用户批量分配默认问候语</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">功能说明</h3>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• 为所有现有用户（包括管理员）分配20条默认英文问候语</li>
                  <li>• 已有问候语的用户将被跳过，不会重复分配</li>
                  <li>• 新注册的用户会自动获得默认问候语</li>
                  <li>• 用户可以在问候语管理页面自定义和管理自己的问候语</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg dark:bg-yellow-900/20">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">注意事项</h3>
                <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                  <li>• 此操作会为所有用户创建默认问候语数据</li>
                  <li>• 建议在系统维护时间执行此操作</li>
                  <li>• 操作完成后会显示详细的处理结果</li>
                </ul>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium mb-1">批量分配默认问候语</h3>
                  <p className="text-sm text-gray-600">为所有现有用户分配20条默认问候语</p>
                </div>
                <Button
                  onClick={assignDefaultGreetings}
                  disabled={assigningGreetings}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {assigningGreetings ? '分配中...' : '开始分配'}
                </Button>
              </div>

              <div className="text-xs text-gray-500 mt-4">
                <p>默认问候语包含：</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div>• Hello! Hope you have a wonderful day.</div>
                  <div>• Hi there! Thanks for your time.</div>
                  <div>• Greetings! We're excited to share this with you.</div>
                  <div>• Good day! Hope this message finds you well.</div>
                  <div>• Hello! We appreciate your interest.</div>
                  <div>• Greetings! Thanks for being part of our community.</div>
                  <div>• Hi! We're glad to connect with you.</div>
                  <div>• Hello! Hope you're having a great day.</div>
                  <div>• Good morning/afternoon! Thanks for your attention.</div>
                  <div>• Greetings! Hope you find this helpful.</div>
                </div>
                <p className="mt-2">...以及另外10条问候语</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 数据导出 Tab */}
        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>数据导出</CardTitle>
              <CardDescription>导出用户的邮件模板和发件人配置数据</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">功能说明</h3>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• 选择要导出的用户和数据类型</li>
                  <li>• 支持 JSON 和 CSV 两种导出格式</li>
                  <li>• 导出的邮箱密码会进行脱敏处理</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-2 block">选择用户</Label>
                  <Select value={exportUserId} onValueChange={setExportUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择用户" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name || user.email} ({user._count.templates} 模板, {user._count.emailProfiles} 邮箱)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 block">导出类型</Label>
                  <Select value={exportType} onValueChange={(value: any) => setExportType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="templates">邮件模板</SelectItem>
                      <SelectItem value="recipients">收件人</SelectItem>
                      <SelectItem value="email-profiles">发件人配置</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 block">导出格式</Label>
                  <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON 格式</SelectItem>
                      <SelectItem value="csv">CSV 格式</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleExport}
                  disabled={!exportUserId || exporting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? '导出中...' : '开始导出'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>导出记录</CardTitle>
              <CardDescription>最近的数据导出操作记录</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                暂无导出记录
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}