"use client"

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'
import {
  Mail,
  Users,
  FileText,
  TrendingUp,
  Calendar,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { CHART_COLORS, DASHBOARD_COLORS } from '@/config/colors'

interface AnalyticsData {
  basicStats: {
    totalSent: number
    totalDelivered: number
    totalOpened: number
    totalClicked: number
    totalRecipients: number
    totalTemplates: number
  }
  dailyStats: Array<{
    date: string
    sent: number
    delivered: number
    opened: number
    clicked: number
  }>
  templateStats: Array<{
    templateName: string
    usageCount: number
  }>
  statusDistribution: Array<{
    status: string
    count: number
    percentage: number
  }>
  rates: {
    deliveryRate: number
    openRate: number
    clickRate: number
  }
}

const COLORS = CHART_COLORS.series

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState(30) // 默认30天

  // 获取统计数据
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/analytics?days=${timeRange}`)
      if (!response.ok) {
        throw new Error('获取统计数据失败')
      }
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchAnalytics()
    }
  }, [session, timeRange])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载统计数据中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
        <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
        <button
          onClick={fetchAnalytics}
          className="mt-2 flex items-center text-sm text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          重试
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">暂无统计数据</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">数据统计</h1>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseFloat(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value={0.25}>最近6小时</option>
            <option value={0.5}>最近12小时</option>
            <option value={1}>最近24小时</option>
            <option value={7}>最近7天</option>
            <option value={30}>最近30天</option>
            <option value={90}>最近90天</option>
            <option value={365}>最近一年</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </button>
        </div>
      </div>

      {/* 基础统计卡片 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <div className="flex h-full w-full items-center justify-center">
                <Mail className="h-6 w-6" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">总发送量</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.basicStats.totalSent.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <div className="flex h-full w-full items-center justify-center">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">送达率</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.rates.deliveryRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
              <div className="flex h-full w-full items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">收件人总数</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.basicStats.totalRecipients.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <div className="flex h-full w-full items-center justify-center">
                <FileText className="h-6 w-6" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">模板总数</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.basicStats.totalTemplates.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <div className="flex h-full w-full items-center justify-center">
                <Calendar className="h-6 w-6" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">打开率</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.rates.openRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <div className="flex h-full w-full items-center justify-center">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">点击率</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.rates.clickRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 每日发送趋势 */}
        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
            每日发送趋势
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sent" 
                  stroke={CHART_COLORS.status.sent} 
                  strokeWidth={2}
                  name="发送量"
                />
                <Line 
                  type="monotone" 
                  dataKey="delivered" 
                  stroke={CHART_COLORS.status.delivered} 
                  strokeWidth={2}
                  name="送达量"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 发送状态分布 */}
        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
            发送状态分布
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, percentage }) => `${status} ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 模板使用统计 */}
      <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
          热门模板 (前10名)
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.templateStats}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="templateName" 
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="usageCount" 
                fill={CHART_COLORS.status.sent} 
                name="使用次数"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 详细数据表格 */}
      <div className="rounded-lg border bg-white shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            详细统计数据
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  指标
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  比率
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  总发送量
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {data.basicStats.totalSent.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  100%
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  成功送达
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {data.basicStats.totalDelivered.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {data.rates.deliveryRate.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  邮件打开
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {data.basicStats.totalOpened.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {data.rates.openRate.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  链接点击
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {data.basicStats.totalClicked.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {data.rates.clickRate.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}