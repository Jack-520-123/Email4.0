'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Wrench, Zap } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import BreadcrumbNav from '@/components/ui/breadcrumb-nav'

interface DiagnosticResult {
  name: string
  status: 'success' | 'error' | 'warning'
  message: string
  details?: string
}

export default function DebugPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState<string | null>(null)

  const runFix = async (action: string, description: string) => {
    setFixing(action)
    try {
      const response = await fetch('/api/fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(`${description}成功`)
        // 重新运行诊断
        await runDiagnostics()
      } else {
        toast.error(`${description}失败: ${data.error}`)
      }
    } catch (error) {
      toast.error(`${description}失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setFixing(null)
    }
  }

  const runDiagnostics = async () => {
    setLoading(true)
    const results: DiagnosticResult[] = []

    try {
      // 测试1: 检查API连接
      try {
        const response = await fetch('/api/debug')
        const data = await response.json()
        if (response.ok) {
          results.push({
            name: 'API连接测试',
            status: 'success',
            message: 'API服务正常'
          })
        } else {
          results.push({
            name: 'API连接测试',
            status: 'error',
            message: 'API服务异常',
            details: data.error
          })
        }
      } catch (error) {
        results.push({
          name: 'API连接测试',
          status: 'error',
          message: 'API连接失败',
          details: error instanceof Error ? error.message : '未知错误'
        })
      }

      // 测试2: 检查活动详情API
      try {
        const response = await fetch('/api/campaigns')
        if (response.ok) {
          const data = await response.json()
          results.push({
            name: '活动列表API测试',
            status: 'success',
            message: `成功获取${data.campaigns?.length || 0}个活动`
          })
        } else {
          results.push({
            name: '活动列表API测试',
            status: 'error',
            message: 'API响应异常',
            details: `状态码: ${response.status}`
          })
        }
      } catch (error) {
        results.push({
          name: '活动列表API测试',
          status: 'error',
          message: '活动列表API失败',
          details: error instanceof Error ? error.message : '未知错误'
        })
      }

      // 测试3: 检查邮件监听状态
      try {
        const response = await fetch('/api/email-monitor')
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            const isRunning = data.data?.monitor?.isRunning
            results.push({
              name: '邮件监听状态检查',
              status: isRunning ? 'success' : 'warning',
              message: isRunning ? '邮件监听服务正在运行' : '邮件监听服务未启动',
              details: `监听器数量: ${data.data?.monitor?.monitorCount || 0}`
            })
          } else {
            results.push({
              name: '邮件监听状态检查',
              status: 'error',
              message: '获取监听状态失败',
              details: data.error
            })
          }
        } else {
          results.push({
            name: '邮件监听状态检查',
            status: 'error',
            message: '邮件监听API异常',
            details: `状态码: ${response.status}`
          })
        }
      } catch (error) {
        results.push({
          name: '邮件监听状态检查',
          status: 'error',
          message: '邮件监听API失败',
          details: error instanceof Error ? error.message : '未知错误'
        })
      }

      // 测试4: 检查数据库连接
      try {
        const response = await fetch('/api/debug')
        const data = await response.json()
        if (data.database) {
          results.push({
            name: '数据库连接测试',
            status: 'success',
            message: '数据库连接正常'
          })
        } else {
          results.push({
            name: '数据库连接测试',
            status: 'warning',
            message: '数据库状态未知'
          })
        }
      } catch (error) {
        results.push({
          name: '数据库连接测试',
          status: 'error',
          message: '数据库连接测试失败',
          details: error instanceof Error ? error.message : '未知错误'
        })
      }

    } catch (error) {
      results.push({
        name: '诊断过程',
        status: 'error',
        message: '诊断过程中发生错误',
        details: error instanceof Error ? error.message : '未知错误'
      })
    }

    setDiagnostics(results)
    setLoading(false)
  }

  useEffect(() => {
    runDiagnostics()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">正常</Badge>
      case 'error':
        return <Badge variant="destructive">错误</Badge>
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">警告</Badge>
      default:
        return <Badge variant="outline">未知</Badge>
    }
  }

  return (
    <div className="container mx-auto p-6">
      <BreadcrumbNav
        title="系统诊断"
        showBackButton={true}
        showHomeButton={true}
        customBackPath="/dashboard"
      />
      <div className="mb-6">
        <p className="text-muted-foreground">检查系统各项功能的运行状态</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>诊断结果</CardTitle>
                <CardDescription>系统各项功能的运行状态检查</CardDescription>
              </div>
              <Button
                onClick={runDiagnostics}
                disabled={loading}
                size="sm"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                重新检查
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {diagnostics.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                  <div className="mt-0.5">
                    {getStatusIcon(result.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{result.name}</h3>
                      {getStatusBadge(result.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                    {result.details && (
                      <div className="text-xs bg-muted p-2 rounded font-mono">
                        {result.details}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快速修复工具</CardTitle>
            <CardDescription>一键修复常见系统问题</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => runFix('reset_stuck_campaigns', '重置卡住的活动')}
                disabled={fixing !== null}
                className="h-auto p-4 flex flex-col items-start gap-2"
              >
                <div className="flex items-center gap-2">
                  {fixing === 'reset_stuck_campaigns' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  <span className="font-medium">重置卡住的活动</span>
                </div>
                <span className="text-sm text-muted-foreground text-left">
                  重置超过30分钟仍在发送状态的活动
                </span>
              </Button>

              <Button
                variant="outline"
                onClick={() => runFix('restart_email_monitor', '重启邮件监听服务')}
                disabled={fixing !== null}
                className="h-auto p-4 flex flex-col items-start gap-2"
              >
                <div className="flex items-center gap-2">
                  {fixing === 'restart_email_monitor' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wrench className="h-4 w-4" />
                  )}
                  <span className="font-medium">重启邮件监听</span>
                </div>
                <span className="text-sm text-muted-foreground text-left">
                  重启邮件监听服务以解决状态显示问题
                </span>
              </Button>

              <Button
                variant="outline"
                onClick={() => runFix('clean_failed_emails', '清理失败邮件记录')}
                disabled={fixing !== null}
                className="h-auto p-4 flex flex-col items-start gap-2"
              >
                <div className="flex items-center gap-2">
                  {fixing === 'clean_failed_emails' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span className="font-medium">清理失败记录</span>
                </div>
                <span className="text-sm text-muted-foreground text-left">
                  清理7天前的失败邮件记录
                </span>
              </Button>

              <Button
                variant="outline"
                onClick={() => runFix('fix_campaign_counters', '修复活动计数器')}
                disabled={fixing !== null}
                className="h-auto p-4 flex flex-col items-start gap-2"
              >
                <div className="flex items-center gap-2">
                  {fixing === 'fix_campaign_counters' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span className="font-medium">修复计数器</span>
                </div>
                <span className="text-sm text-muted-foreground text-left">
                  修复活动的发送和失败计数器
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>常见问题解决方案</CardTitle>
            <CardDescription>针对发现的问题提供解决建议</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>发送详情页面加载问题：</strong>
                  <br />1. 检查网络连接是否正常
                  <br />2. 确认活动ID是否有效
                  <br />3. 检查浏览器控制台是否有错误信息
                  <br />4. 尝试刷新页面或清除浏览器缓存
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>邮件发送失败问题：</strong>
                  <br />1. 检查邮件配置是否正确（SMTP服务器、端口、认证信息）
                  <br />2. 确认邮件模板和收件人列表是否完整
                  <br />3. 检查网络连接和防火墙设置
                  <br />4. 查看详细错误日志获取更多信息
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>邮件监听状态显示问题：</strong>
                  <br />1. 确认邮件配置中已启用IMAP监听
                  <br />2. 检查IMAP服务器配置是否正确
                  <br />3. 验证邮箱密码和权限设置
                  <br />4. 尝试重启监听服务
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}