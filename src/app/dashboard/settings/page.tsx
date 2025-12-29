'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { User, Settings, Mail, Shield, Database, Bell, Palette, Globe } from "lucide-react"
import { toast } from "react-hot-toast"

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  
  // 权限检查：只有管理员才能访问系统设置
  if (session && session.user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">访问被拒绝</h1>
          <p className="text-gray-600 dark:text-gray-400">您没有权限访问此页面。</p>
        </div>
      </div>
    )
  }
  
  // 用户资料设置
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  // 邮件设置
  const [emailSettings, setEmailSettings] = useState({
    smtpServer: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    fromName: '',
    fromEmail: '',
    enableSSL: true
  })
  
  // 系统设置
  const [systemSettings, setSystemSettings] = useState({
    siteName: '欢喜邮件营销系统',
    siteDescription: '专业的邮件营销平台',
    maxEmailsPerDay: 1000,
    enableRegistration: false,
    enableEmailVerification: true,
    sessionTimeout: 24,
    logLevel: 'info'
  })
  
  // 通知设置
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    campaignUpdates: true,
    systemAlerts: true,
    weeklyReports: false
  })
  
  useEffect(() => {
    if (session?.user) {
      setProfileData(prev => ({
        ...prev,
        name: session.user.name || '',
        email: session.user.email || ''
      }))
    }
    loadSettings()
  }, [session])
  
  const loadSettings = async () => {
    try {
      // 加载邮件设置
      const emailResponse = await fetch('/api/settings/email')
      if (emailResponse.ok) {
        const emailData = await emailResponse.json()
        setEmailSettings(emailData)
      }
      
      // 加载系统设置
      const systemResponse = await fetch('/api/settings/system')
      if (systemResponse.ok) {
        const systemData = await systemResponse.json()
        setSystemSettings(systemData)
      }
      
      // 加载通知设置
      const notificationResponse = await fetch('/api/settings/notifications')
      if (notificationResponse.ok) {
        const notificationData = await notificationResponse.json()
        setNotificationSettings(notificationData)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }
  
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: profileData.name,
          currentPassword: profileData.currentPassword,
          newPassword: profileData.newPassword
        })
      })
      
      if (response.ok) {
        toast.success('个人资料更新成功')
        setProfileData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }))
        await update()
      } else {
        const error = await response.json()
        toast.error(error.message || '更新失败')
      }
    } catch (error) {
      toast.error('更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }
  
  const handleEmailSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailSettings)
      })
      
      if (response.ok) {
        toast.success('邮件设置更新成功')
      } else {
        toast.error('更新失败')
      }
    } catch (error) {
      toast.error('更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }
  
  const handleSystemSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await fetch('/api/settings/system', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(systemSettings)
      })
      
      if (response.ok) {
        toast.success('系统设置更新成功')
      } else {
        toast.error('更新失败')
      }
    } catch (error) {
      toast.error('更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }
  
  const handleNotificationSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationSettings)
      })
      
      if (response.ok) {
        toast.success('通知设置更新成功')
      } else {
        toast.error('更新失败')
      }
    } catch (error) {
      toast.error('更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }
  
  const tabs = [
    { id: 'profile', name: '个人资料', icon: User },
    { id: 'email', name: '邮件设置', icon: Mail },
    { id: 'system', name: '系统设置', icon: Settings },
    { id: 'notifications', name: '通知设置', icon: Bell }
  ]
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">系统设置</h1>
      </div>
      
      <div className="flex space-x-8">
        {/* 侧边栏导航 */}
        <div className="w-64">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>
        
        {/* 主内容区域 */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-6">个人资料</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">姓名</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">邮箱</label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                  />
                </div>
                
                <div className="border-t pt-6">
                  <h3 className="text-md font-medium text-gray-900 mb-4">修改密码</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">当前密码</label>
                      <input
                        type="password"
                        value={profileData.currentPassword}
                        onChange={(e) => setProfileData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">新密码</label>
                      <input
                        type="password"
                        value={profileData.newPassword}
                        onChange={(e) => setProfileData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">确认新密码</label>
                      <input
                        type="password"
                        value={profileData.confirmPassword}
                        onChange={(e) => setProfileData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? '更新中...' : '更新资料'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {activeTab === 'email' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-6">邮件设置</h2>
              <form onSubmit={handleEmailSettingsUpdate} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SMTP服务器</label>
                    <input
                      type="text"
                      value={emailSettings.smtpServer}
            onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpServer: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">端口</label>
                    <input
                      type="number"
                      value={emailSettings.smtpPort}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpPort: parseInt(e.target.value) }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">用户名</label>
                    <input
                      type="text"
                      value={emailSettings.smtpUser}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpUser: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">密码</label>
                    <input
                      type="password"
                      value={emailSettings.smtpPassword}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpPassword: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">发件人姓名</label>
                    <input
                      type="text"
                      value={emailSettings.fromName}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, fromName: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">发件人邮箱</label>
                    <input
                      type="email"
                      value={emailSettings.fromEmail}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, fromEmail: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={emailSettings.enableSSL}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, enableSSL: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">启用SSL/TLS加密</span>
                  </label>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? '保存中...' : '保存设置'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {activeTab === 'system' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-6">系统设置</h2>
              <form onSubmit={handleSystemSettingsUpdate} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">网站名称</label>
                    <input
                      type="text"
                      value={systemSettings.siteName}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, siteName: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">每日最大发送量</label>
                    <input
                      type="number"
                      value={systemSettings.maxEmailsPerDay}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, maxEmailsPerDay: parseInt(e.target.value) }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">网站描述</label>
                  <textarea
                    value={systemSettings.siteDescription}
                    onChange={(e) => setSystemSettings(prev => ({ ...prev, siteDescription: e.target.value }))}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">会话超时时间（小时）</label>
                    <input
                      type="number"
                      value={systemSettings.sessionTimeout}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">日志级别</label>
                    <select
                      value={systemSettings.logLevel}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, logLevel: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="debug">Debug</option>
                      <option value="info">Info</option>
                      <option value="warn">Warning</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={systemSettings.enableRegistration}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, enableRegistration: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">允许用户注册</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={systemSettings.enableEmailVerification}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, enableEmailVerification: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">启用邮箱验证</span>
                  </label>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? '保存中...' : '保存设置'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {activeTab === 'notifications' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-6">通知设置</h2>
              <form onSubmit={handleNotificationSettingsUpdate} className="space-y-6">
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">邮件通知</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                      className="ml-2"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">活动更新通知</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.campaignUpdates}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, campaignUpdates: e.target.checked }))}
                      className="ml-2"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">系统警报</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.systemAlerts}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, systemAlerts: e.target.checked }))}
                      className="ml-2"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">周报</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.weeklyReports}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, weeklyReports: e.target.checked }))}
                      className="ml-2"
                    />
                  </label>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? '保存中...' : '保存设置'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}