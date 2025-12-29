'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  PlusCircle,
  Search,
  Mail,
  Server,
  Edit,
  Trash,
  Loader2,
  Eye,
  EyeOff,
  TestTube
} from 'lucide-react'

interface EmailProfile {
  id: string
  nickname: string
  email: string
  smtpServer: string
  smtpPort: number
  smtpSecure: boolean
  sendInterval?: number     // 发送间隔（秒）
  randomInterval?: number   // 随机间隔（±秒）
  maxEmailsPerHour?: number // 每小时最大发送数
  createdAt: string
  updatedAt: string
}

export default function EmailProfilesPage() {
  const { data: session } = useSession()
  const [profiles, setProfiles] = useState<EmailProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState<EmailProfile | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [showPlainTest, setShowPlainTest] = useState(false)
  const [plainTestData, setPlainTestData] = useState({
    email: '',
    password: '',
    smtpServer: '',
    smtpPort: 587,
    testEmail: ''
  })
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    smtpServer: '',
    smtpPort: 587,
    smtpSecure: true,
    sendInterval: 5,        // 默认5秒
    randomInterval: 3,      // 默认±3秒
    maxEmailsPerHour: 100   // 默认100封/小时
  })
  const [formLoading, setFormLoading] = useState(false)

  // 获取邮箱配置列表
  const fetchProfiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/email-profiles')
      if (!response.ok) {
        throw new Error('获取邮箱配置失败')
      }
      const data = await response.json()
      setProfiles(data.profiles || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取邮箱配置失败')
    } finally {
      setLoading(false)
    }
  }

  // 添加或更新邮箱配置
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.smtpServer) {
      alert('请填写所有必需字段')
      return
    }

    if (!editingProfile && !formData.password) {
      alert('请填写邮箱密码')
      return
    }

    try {
      setFormLoading(true)
      const url = editingProfile ? `/api/email-profiles/${editingProfile.id}` : '/api/email-profiles'
      const method = editingProfile ? 'PUT' : 'POST'
      
      const body: any = {
        name: formData.name,
        email: formData.email,
        smtpServer: formData.smtpServer,
        smtpPort: formData.smtpPort,
        smtpSecure: formData.smtpSecure
      }

      // 只有在新建或者填写了密码时才发送密码
      if (!editingProfile || formData.password) {
        body.password = formData.password
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '保存邮箱配置失败')
      }

      setFormData({
        name: '',
        email: '',
        password: '',
        smtpServer: '',
        smtpPort: 587,
        smtpSecure: true,
        sendInterval: 5,
        randomInterval: 3,
        maxEmailsPerHour: 100
      })
      setShowAddForm(false)
      setEditingProfile(null)
      fetchProfiles()
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存邮箱配置失败')
    } finally {
      setFormLoading(false)
    }
  }

  // 删除邮箱配置
  const deleteProfile = async (id: string) => {
    try {
      const response = await fetch(`/api/email-profiles/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('删除邮箱配置失败')
      }
      setProfiles(profiles.filter(profile => profile.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除邮箱配置失败')
    }
  }

  // 测试邮箱配置
  const testProfile = async (id: string) => {
    try {
      setTesting(id)
      const response = await fetch(`/api/email-profiles/${id}/test`, {
        method: 'POST',
      })

      if (response.ok) {
        alert('邮箱配置测试成功！测试邮件已发送到您的邮箱')
      } else {
        const errorData = await response.json().catch(() => ({ error: '无法解析错误信息' }))
        alert(`测试失败: ${errorData.error || response.statusText}`)
      }
    } catch (err) {
      alert('测试邮箱配置失败，请检查网络连接或联系管理员')
    } finally {
      setTesting(null)
    }
  }

  // 明文密码测试邮箱
  const testPlainPassword = async () => {
    if (!plainTestData.email || !plainTestData.password || !plainTestData.smtpServer || !plainTestData.testEmail) {
      alert('请填写所有必需字段')
      return
    }

    try {
      setTesting('plain')
      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plainPassword: plainTestData.password,
          email: plainTestData.email,
          smtpServer: plainTestData.smtpServer,
          smtpPort: plainTestData.smtpPort,
          testEmail: plainTestData.testEmail
        }),
      })
      
      const result = await response.json()
      
      if (response.ok) {
        alert('明文密码测试成功！测试邮件已发送')
      } else {
        alert(`测试失败: ${result.error}`)
      }
    } catch (err) {
      alert('明文密码测试失败')
    } finally {
      setTesting(null)
    }
  }

  // 开始编辑
  const startEdit = (profile: EmailProfile) => {
    setEditingProfile(profile)
    setFormData({
      name: profile.nickname,
      email: profile.email,
      password: '', // 编辑时不显示密码
      smtpServer: profile.smtpServer,
      smtpPort: profile.smtpPort,
      smtpSecure: profile.smtpPort === 465, // 根据端口号判断SSL
      sendInterval: profile.sendInterval || 5,
      randomInterval: profile.randomInterval || 3,
      maxEmailsPerHour: profile.maxEmailsPerHour || 100
    })
    setShowAddForm(true)
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingProfile(null)
    setFormData({
      name: '',
      email: '',
      password: '',
      smtpServer: '',
      smtpPort: 587,
      smtpSecure: true,
      sendInterval: 5,
      randomInterval: 3,
      maxEmailsPerHour: 100
    })
    setShowAddForm(false)
  }

  useEffect(() => {
    if (session) {
      fetchProfiles()
    }
  }, [session])

  const filteredProfiles = searchTerm
    ? profiles.filter(profile =>
        profile.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.smtpServer.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : profiles

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
        <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
        <button
          onClick={fetchProfiles}
          className="mt-2 text-sm text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">邮箱配置</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          添加邮箱
        </button>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="search"
          className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="搜索邮箱配置..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 添加/编辑表单 */}
      {showAddForm && (
        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
            {editingProfile ? '编辑邮箱配置' : '添加邮箱配置'}
          </h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  配置名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="例如：公司邮箱"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  邮箱地址 *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                邮箱密码 {editingProfile ? '(留空则不修改)' : '*'}
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="邮箱密码或应用专用密码"
                  required={!editingProfile}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  SMTP 服务器 *
                </label>
                <input
                  type="text"
                  value={formData.smtpServer}
            onChange={(e) => setFormData({ ...formData, smtpServer: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="smtp.gmail.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  端口 *
                </label>
                <input
                  type="number"
                  value={formData.smtpPort}
                  onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  min="1"
                  max="65535"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  安全连接
                </label>
                <select
                  value={formData.smtpSecure ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, smtpSecure: e.target.value === 'true' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="true">TLS/SSL (推荐)</option>
                  <option value="false">无加密</option>
                </select>
              </div>
            </div>

            {/* 发送频次设置 */}
            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">发送频次设置</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    发送间隔（秒）
                  </label>
                  <input
                    type="number"
                    value={formData.sendInterval}
                    onChange={(e) => setFormData({ ...formData, sendInterval: parseInt(e.target.value) || 5 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    min="1"
                    max="3600"
                    placeholder="5"
                  />
                  <p className="mt-1 text-xs text-gray-500">每封邮件之间的基础间隔时间</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    随机间隔（±秒）
                  </label>
                  <input
                    type="number"
                    value={formData.randomInterval}
                    onChange={(e) => setFormData({ ...formData, randomInterval: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    min="0"
                    max="300"
                    placeholder="3"
                  />
                  <p className="mt-1 text-xs text-gray-500">随机增减的时间范围</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    每小时最大发送数
                  </label>
                  <input
                    type="number"
                    value={formData.maxEmailsPerHour}
                    onChange={(e) => setFormData({ ...formData, maxEmailsPerHour: parseInt(e.target.value) || 100 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    min="1"
                    max="1000"
                    placeholder="100"
                  />
                  <p className="mt-1 text-xs text-gray-500">限制发送频率避免被封</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {formLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 邮箱配置列表 */}
      <div className="overflow-hidden rounded-lg border bg-white shadow dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                配置信息
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                SMTP 设置
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                发送频次
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                创建时间
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {filteredProfiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <div className="flex h-full w-full items-center justify-center">
                        <Mail className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {profile.nickname}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {profile.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Server className="mr-2 h-4 w-4" />
                    <div>
                      <div>{profile.smtpServer}:{profile.smtpPort}</div>
                      <div className="text-xs">
                        {profile.smtpPort === 465 ? 'SSL' : profile.smtpPort === 587 ? 'STARTTLS' : '无加密'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div>
                    <div>间隔: {profile.sendInterval || 5}s</div>
                    <div className="text-xs">
                      随机: ±{profile.randomInterval || 3}s
                    </div>
                    <div className="text-xs">
                      限制: {profile.maxEmailsPerHour || 100}/小时
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(profile.createdAt).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => testProfile(profile.id)}
                      disabled={testing === profile.id}
                      className="rounded p-1 text-green-600 hover:bg-green-100 hover:text-green-700 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-900/30"
                      title="测试连接"
                    >
                      {testing === profile.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => startEdit(profile)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                      title="编辑"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('确定要删除此邮箱配置吗？')) {
                          deleteProfile(profile.id)
                        }
                      }}
                      className="rounded p-1 text-red-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                      title="删除"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredProfiles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <Mail className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    没有找到邮箱配置
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {searchTerm ? '尝试调整搜索条件' : '开始添加您的第一个邮箱配置'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}