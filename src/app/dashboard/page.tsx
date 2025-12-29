'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from "next-auth/react"
import { BarChart3, Users, Mail, ArrowUpRight, Clock, TrendingUp, RefreshCw, Loader2, MessageSquare, AlertTriangle, UserX, Shield, MailX, MousePointer } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts"
import WordCloud from '@/components/WordCloud'
import { CHART_COLORS, DASHBOARD_COLORS } from '@/config/colors'

const COLORS = CHART_COLORS.series

export default function DashboardPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState(30)
  const [selectedSender, setSelectedSender] = useState<string>('all')
  const [senderProfiles, setSenderProfiles] = useState<Array<{ id: string, nickname: string, email: string }>>([])

  // 格式化时间范围显示文本
  const getTimeRangeText = (range: number) => {
    if (range < 1) {
      const hours = range * 24
      return `最近${hours}小时`
    }
    return `最近${range}天`
  }

  // 清空的数据状态
  const [stats, setStats] = useState({
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalRecipients: 0,
    totalTemplates: 0,
    totalReplies: 0,
    repliesLast24h: 0,
    repliesInRange: 0,
    enabledMonitoringProfiles: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
    failureRate: 0,
    replyRate: 0,
    uniqueClicks: 0,
    blacklistedRecipients: 0,
    failedEmails: {
      total: 0,
      failed: 0,
      bounced: 0,
      rejected: 0,
      invalid: 0,
      blacklisted: 0,
      blacklistedRecipients: 0
    }
  })

  const [emailActivityData, setEmailActivityData] = useState([
    { name: "周一", sent: 0, delivered: 0, opened: 0, clicked: 0 },
    { name: "周二", sent: 0, delivered: 0, opened: 0, clicked: 0 },
    { name: "周三", sent: 0, delivered: 0, opened: 0, clicked: 0 },
    { name: "周四", sent: 0, delivered: 0, opened: 0, clicked: 0 },
    { name: "周五", sent: 0, delivered: 0, opened: 0, clicked: 0 },
    { name: "周六", sent: 0, delivered: 0, opened: 0, clicked: 0 },
    { name: "周日", sent: 0, delivered: 0, opened: 0, clicked: 0 },
  ])

  const [statusDistribution, setStatusDistribution] = useState([
    { name: "已送达", value: 0, color: CHART_COLORS.status.delivered },
    { name: "已打开", value: 0, color: CHART_COLORS.status.opened },
    { name: "已点击", value: 0, color: CHART_COLORS.status.clicked },
    { name: "退回", value: 0, color: CHART_COLORS.status.bounced },
  ])

  const [templateStats, setTemplateStats] = useState([])

  const [recentActivity, setRecentActivity] = useState<Array<{ id: string | number, action: string, template?: string, count?: number, time: string, type?: string, status?: string, subject?: string }>>([])
  const [replyWords, setReplyWords] = useState([])
  const [userProfileRadarData, setUserProfileRadarData] = useState([])
  const [statusTrend, setStatusTrend] = useState([])
  const [wordCloudData, setWordCloudData] = useState([])
  const [hourlyStats, setHourlyStats] = useState([])

  // 获取发件人配置列表
  const fetchSenderProfiles = async () => {
    try {
      const response = await fetch('/api/sender-profiles')
      if (!response.ok) {
        throw new Error('获取发件人配置失败')
      }
      const data = await response.json()
      setSenderProfiles(data.profiles || [])
    } catch (error) {
      console.error('获取发件人配置失败:', error)
      setSenderProfiles([])
    }
  }

  const refreshData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/dashboard/stats?timeRange=${timeRange}&senderId=${selectedSender}`)
      if (!response.ok) {
        throw new Error('获取数据失败')
      }

      const data = await response.json()

      if (!data || !data.stats) {
        throw new Error('从API返回的统计数据格式无效')
      }

      setStats(data.stats)
      setEmailActivityData(data.emailActivityData || [])
      setStatusDistribution(data.statusDistribution || [])
      setTemplateStats(data.templateStats || [])
      setRecentActivity(data.recentActivity || [])
      setReplyWords(data.replyWords || [])
      setStatusTrend(data.statusTrend || [])
      setWordCloudData(data.wordCloudData || [])
      setHourlyStats(data.hourlyStats || [])

      // 获取用户画像雷达图数据
      try {
        const radarResponse = await fetch('/api/user-profiles/radar')
        if (radarResponse.ok) {
          const radarData = await radarResponse.json()
          setUserProfileRadarData(radarData.data || [])
        }
      } catch (error) {
        console.error('获取用户画像雷达图数据失败:', error)
        setUserProfileRadarData([])
      }
    } catch (error) {
      console.error('获取数据失败:', error)
      // 设置默认值
      setStats({
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalRecipients: 0,
        totalTemplates: 0,
        totalReplies: 0,
        repliesLast24h: 0,
        repliesInRange: 0,
        enabledMonitoringProfiles: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        failureRate: 0,
        replyRate: 0,
        uniqueClicks: 0,
        blacklistedRecipients: 0,
        failedEmails: {
          total: 0,
          failed: 0,
          bounced: 0,
          rejected: 0,
          invalid: 0,
          blacklisted: 0,
          blacklistedRecipients: 0
        }
      })
      setEmailActivityData([])
      setStatusDistribution([])
      setTemplateStats([])
      setRecentActivity([])
      setReplyWords([])
      setUserProfileRadarData([])
      setStatusTrend([])
      setWordCloudData([])
      setHourlyStats([])
    } finally {
      setLoading(false)
    }
  }, [timeRange, selectedSender])

  useEffect(() => {
    fetchSenderProfiles()
  }, [])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 页面头部 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">仪表板与数据分析</h1>
            <p className="text-gray-600 mt-1">
              实时监控您的邮件营销效果
              {selectedSender !== 'all' && (
                <span className="ml-2 text-blue-600 font-medium">
                  - {senderProfiles.find(p => p.id === selectedSender)?.nickname || '未知发件人'}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* 发件人筛选 */}
            <select
              value={selectedSender}
              onChange={(e) => setSelectedSender(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">所有发件人</option>
              {senderProfiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.nickname} ({profile.email})
                </option>
              ))}
            </select>

            {/* 时间范围选择 */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={0.125}>最近3小时</option>
              <option value={0.5}>最近12小时</option>
              <option value={1}>最近1天</option>
              <option value={3}>最近3天</option>
              <option value={7}>最近7天</option>
              <option value={30}>最近30天</option>
              <option value={90}>最近90天</option>
            </select>

            <button
              onClick={refreshData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              刷新数据
            </button>
          </div>
        </div>

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">送达率</p>
                <p className="text-2xl font-bold text-gray-900">{stats.deliveryRate.toFixed(1)}%</p>
                <p className="text-xs text-blue-600 mt-1 flex items-center">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  {getTimeRangeText(timeRange)}内
                </p>
              </div>
              <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">打开率</p>
                <p className="text-2xl font-bold text-gray-900">{stats.openRate.toFixed(1)}%</p>
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  {getTimeRangeText(timeRange)}内
                </p>
              </div>
              <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">点击率</p>
                <p className="text-2xl font-bold text-gray-900">{stats.clickRate.toFixed(1)}%</p>
                <p className="text-xs text-purple-600 mt-1 flex items-center">
                  <MousePointer className="h-3 w-3 mr-1" />
                  {getTimeRangeText(timeRange)}内
                </p>
              </div>
              <div className="h-10 w-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <MousePointer className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">回复率</p>
                <p className="text-2xl font-bold text-gray-900">{stats.replyRate.toFixed(1)}%</p>
                <p className="text-xs text-orange-600 mt-1 flex items-center">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {getTimeRangeText(timeRange)}内
                </p>
              </div>
              <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">失败率</p>
                <p className="text-2xl font-bold text-red-600">{stats.failureRate?.toFixed(1) || 0}%</p>
                <p className="text-xs text-red-500 mt-1 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  需关注
                </p>
              </div>
              <div className="h-10 w-10 bg-red-50 rounded-lg flex items-center justify-center">
                <MailX className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">独立点击</p>
                <p className="text-2xl font-bold text-gray-900">{stats.uniqueClicks?.toLocaleString() || 0}</p>
                <p className="text-xs text-indigo-600 mt-1 flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  去重用户
                </p>
              </div>
              <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* 邮件回复与统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总回复数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalReplies.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">累计收到的回复</p>
              </div>
              <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">24小时回复</p>
                <p className="text-2xl font-bold text-gray-900">{stats.repliesLast24h.toLocaleString()}</p>
                <p className="text-xs text-blue-600 mt-1 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  最近一天
                </p>
              </div>
              <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{getTimeRangeText(timeRange)}回复</p>
                <p className="text-2xl font-bold text-gray-900">{stats.repliesInRange.toLocaleString()}</p>
                <p className="text-xs text-purple-600 mt-1 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  时间范围内
                </p>
              </div>
              <div className="h-10 w-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* 系统状态卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">收件人总数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRecipients.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">系统中的收件人</p>
              </div>
              <div className="h-12 w-12 bg-indigo-50 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">邮件模板</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTemplates.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">可用模板数量</p>
              </div>
              <div className="h-12 w-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                <Mail className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">监控配置</p>
                <p className="text-2xl font-bold text-gray-900">{stats.enabledMonitoringProfiles.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <Shield className="h-3 w-3 mr-1" />
                  已启用监控
                </p>
              </div>
              <div className="h-12 w-12 bg-green-50 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">黑名单邮箱</p>
                <p className="text-2xl font-bold text-gray-900">{stats.blacklistedRecipients?.toLocaleString() || 0}</p>
                <p className="text-xs text-red-600 mt-1 flex items-center">
                  <UserX className="h-3 w-3 mr-1" />
                  已拉黑收件人
                </p>
              </div>
              <div className="h-12 w-12 bg-red-50 rounded-lg flex items-center justify-center">
                <UserX className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* 失败邮箱统计卡片 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">失败邮箱统计</h3>
              <p className="text-sm text-gray-600 mt-1">{getTimeRangeText(timeRange)}内的邮件发送失败情况</p>
            </div>
            <Link href="/dashboard/failed-recipients" className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center">
              查看详情
              <ArrowUpRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failedEmails?.total?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-600 mt-1">总失败数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.failedEmails?.failed?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-600 mt-1">发送失败</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.failedEmails?.bounced?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-600 mt-1">邮件退回</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.failedEmails?.rejected?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-600 mt-1">被拒收</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-600">{stats.failedEmails?.invalid?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-600 mt-1">无效邮箱</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.failedEmails?.blacklisted?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-600 mt-1">黑名单</div>
            </div>
          </div>
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 邮件活动趋势 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">邮件活动趋势</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={emailActivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value}%`,
                      name
                    ]}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="sent" stackId="1" stroke={CHART_COLORS.status.sent} fill={CHART_COLORS.status.sent} fillOpacity={0.6} name="发送" />
                  <Area type="monotone" dataKey="delivered" stackId="1" stroke={CHART_COLORS.status.delivered} fill={CHART_COLORS.status.delivered} fillOpacity={0.6} name="送达" />
                  <Area type="monotone" dataKey="opened" stackId="1" stroke={CHART_COLORS.status.opened} fill={CHART_COLORS.status.opened} fillOpacity={0.6} name="打开" />
                  <Area type="monotone" dataKey="clicked" stackId="1" stroke={CHART_COLORS.status.clicked} fill={CHART_COLORS.status.clicked} fillOpacity={0.6} name="点击" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 邮件状态分布 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">邮件状态分布</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 模板效果统计 */}
        {templateStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">模板效果统计</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={templateStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sent" fill={CHART_COLORS.status.sent} name="发送量" />
                  <Bar dataKey="opened" fill={CHART_COLORS.status.opened} name="打开量" />
                  <Bar dataKey="clicked" fill={CHART_COLORS.status.clicked} name="点击量" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 状态趋势图 */}
        {statusTrend.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">状态趋势分析</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={statusTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value}%`,
                      name
                    ]}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="deliveryRate" stroke={CHART_COLORS.status.delivered} name="送达率" />
                  <Line type="monotone" dataKey="openRate" stroke={CHART_COLORS.status.opened} name="打开率" />
                  <Line type="monotone" dataKey="clickRate" stroke={CHART_COLORS.status.clicked} name="点击率" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 小时统计图 */}
        {hourlyStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">24小时活动分布</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill={CHART_COLORS.status.sent} name="活动数量" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 用户画像雷达图 */}
        {userProfileRadarData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">用户画像分析</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={userProfileRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis />
                  <Radar name="用户画像" dataKey="A" stroke={CHART_COLORS.series[0]} fill={CHART_COLORS.series[0]} fillOpacity={0.6} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 回复词云 */}
        {wordCloudData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">回复关键词分析</h3>
            <div className="h-80">
              <WordCloud words={wordCloudData} />
            </div>
          </div>
        )}

        {/* 最近活动 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">最近活动</h3>
            <Link
              href="/dashboard/history"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              查看全部
            </Link>
          </div>
          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {activity.type === 'email_sent' && <Mail className="h-5 w-5 text-blue-600" />}
                      {activity.type === 'email_opened' && <BarChart3 className="h-5 w-5 text-green-600" />}
                      {activity.type === 'email_clicked' && <Users className="h-5 w-5 text-purple-600" />}
                      {activity.type === 'email_failed' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                      {activity.type === 'email_bounced' && <MailX className="h-5 w-5 text-orange-600" />}
                      {activity.type === 'email_unsubscribed' && <UserX className="h-5 w-5 text-gray-600" />}
                      {!activity.type && <Mail className="h-5 w-5 text-gray-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                      {activity.template && (
                        <p className="text-xs text-gray-500">模板: {activity.template}</p>
                      )}
                      {activity.subject && (
                        <p className="text-xs text-gray-500">主题: {activity.subject}</p>
                      )}
                      {activity.count && (
                        <p className="text-xs text-gray-500">数量: {activity.count}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {activity.time}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>暂无最近活动</p>
              </div>
            )}
          </div>
        </div>


      </div>
    </div>
  )
}