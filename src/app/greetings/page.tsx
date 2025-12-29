'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Edit, Trash2, Star, StarOff, Home, ChevronRight } from 'lucide-react'

interface Greeting {
  id: string
  content: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function GreetingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [greetings, setGreetings] = useState<Greeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newGreeting, setNewGreeting] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetchGreetings()
  }, [session, status, router])

  const fetchGreetings = async () => {
    try {
      const response = await fetch('/api/greetings')
      if (response.ok) {
        const data = await response.json()
        // 合并用户自定义问候语和默认问候语
        const allGreetings = [...(data.userGreetings || []), ...(data.defaultGreetings || [])]
        setGreetings(allGreetings)
      }
    } catch (error) {
      console.error('获取问候语失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddGreeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGreeting.trim()) {
      alert('请输入问候语内容')
      return
    }

    try {
      const response = await fetch('/api/greetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newGreeting.trim(),
        }),
      })

      if (response.ok) {
        setNewGreeting('')
        setShowAddForm(false)
        fetchGreetings()
        alert('问候语添加成功！')
      } else {
        const errorData = await response.json()
        alert(`添加失败: ${errorData.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('添加问候语失败:', error)
      alert('添加问候语失败，请稍后重试')
    }
  }

  const handleUpdateGreeting = async (id: string) => {
    if (!editingContent.trim()) {
      alert('请输入问候语内容')
      return
    }

    try {
      const response = await fetch(`/api/greetings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editingContent.trim(),
        }),
      })

      if (response.ok) {
        setEditingId(null)
        setEditingContent('')
        fetchGreetings()
        alert('问候语更新成功！')
      } else {
        const errorData = await response.json()
        alert(`更新失败: ${errorData.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('更新问候语失败:', error)
      alert('更新问候语失败，请稍后重试')
    }
  }

  const handleDeleteGreeting = async (id: string) => {
    if (!confirm('确定要删除这个问候语吗？')) return

    try {
      const response = await fetch(`/api/greetings/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchGreetings()
      }
    } catch (error) {
      console.error('删除问候语失败:', error)
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/greetings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !isActive,
        }),
      })

      if (response.ok) {
        fetchGreetings()
      }
    } catch (error) {
      console.error('更新问候语状态失败:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 面包屑导航 */}
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
          <Link href="/dashboard" className="flex items-center hover:text-gray-900 dark:hover:text-white transition-colors">
            <Home className="w-4 h-4 mr-1" />
            仪表盘
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 dark:text-white font-medium">问候语管理</span>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">问候语管理</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  管理邮件模板中使用的问候语，系统会随机选择激活的问候语
                </p>
              </div>
              <div className="flex space-x-3">
                <Link
                  href="/templates"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  返回模板
                </Link>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加问候语
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {showAddForm && (
              <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700">
                <form onSubmit={handleAddGreeting}>
                  <div className="mb-4">
                    <label htmlFor="newGreeting" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      新问候语内容
                    </label>
                    <input
                      type="text"
                      id="newGreeting"
                      value={newGreeting}
                      onChange={(e) => setNewGreeting(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      placeholder="例如：您好！祝您工作顺利！"
                      required
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      添加
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false)
                        setNewGreeting('')
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                      取消
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-4">
              {greetings.map((greeting) => (
                <div
                  key={greeting.id}
                  className={`p-4 border rounded-lg ${
                    greeting.isActive
                      ? 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {editingId === greeting.id ? (
                        <div className="flex items-center space-x-3">
                          <input
                            type="text"
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                          <button
                            onClick={() => handleUpdateGreeting(greeting.id)}
                            className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null)
                              setEditingContent('')
                            }}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-900 dark:text-white">{greeting.content}</p>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                            {greeting.isDefault && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                系统默认
                              </span>
                            )}
                            <span>状态: {greeting.isActive ? '激活' : '禁用'}</span>
                            <span>创建时间: {new Date(greeting.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(greeting.id, greeting.isActive)}
                        className={`p-2 rounded-md ${
                          greeting.isActive
                            ? 'text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={greeting.isActive ? '点击禁用' : '点击激活'}
                      >
                        {greeting.isActive ? <Star className="h-5 w-5" /> : <StarOff className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(greeting.id)
                          setEditingContent(greeting.content)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-md dark:text-blue-400 dark:hover:bg-blue-900"
                        title="编辑"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteGreeting(greeting.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-md dark:text-red-400 dark:hover:bg-red-900"
                        title="删除"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {greetings.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">暂无问候语</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加第一个问候语
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}