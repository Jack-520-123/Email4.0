'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  PlusCircle,
  Search,
  List,
  Users,
  Edit,
  Trash,
  Loader2
} from 'lucide-react'

interface RecipientList {
  id: string
  name: string
  description?: string
  _count: {
    recipients: number
  }
  createdAt: string
  updatedAt: string
}

export default function RecipientListsPage() {
  const { data: session } = useSession()
  const [lists, setLists] = useState<RecipientList[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingList, setEditingList] = useState<RecipientList | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [formLoading, setFormLoading] = useState(false)

  // 获取收件人列表
  const fetchLists = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/recipient-lists')
      if (!response.ok) {
        throw new Error('获取收件人列表失败')
      }
      const data = await response.json()
      setLists(data.lists || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取收件人列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 添加或更新列表
  const saveList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      alert('请填写列表名称')
      return
    }

    try {
      setFormLoading(true)
      const url = editingList ? `/api/recipient-lists/${editingList.id}` : '/api/recipient-lists'
      const method = editingList ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '保存列表失败')
      }

      setFormData({ name: '', description: '' })
      setShowAddForm(false)
      setEditingList(null)
      fetchLists()
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存列表失败')
    } finally {
      setFormLoading(false)
    }
  }

  // 删除列表
  const deleteList = async (id: string) => {
    try {
      const response = await fetch(`/api/recipient-lists/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('删除列表失败')
      }
      setLists(lists.filter(list => list.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除列表失败')
    }
  }

  // 开始编辑
  const startEdit = (list: RecipientList) => {
    setEditingList(list)
    setFormData({
      name: list.name,
      description: list.description || ''
    })
    setShowAddForm(true)
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingList(null)
    setFormData({ name: '', description: '' })
    setShowAddForm(false)
  }

  useEffect(() => {
    if (session) {
      fetchLists()
    }
  }, [session])

  const filteredLists = searchTerm
    ? lists.filter(list =>
        list.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (list.description && list.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : lists

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
          onClick={fetchLists}
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">收件人列表</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          新建列表
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
          placeholder="搜索列表..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 添加/编辑表单 */}
      {showAddForm && (
        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
            {editingList ? '编辑列表' : '新建列表'}
          </h2>
          <form onSubmit={saveList} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                列表名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                描述
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="可选的列表描述"
              />
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

      {/* 列表网格 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredLists.map((list) => (
          <div
            key={list.id}
            className="rounded-lg border bg-white p-6 shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <div className="flex h-full w-full items-center justify-center">
                    <List className="h-5 w-5" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {list.name}
                  </h3>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Users className="mr-1 h-4 w-4" />
                    {list._count.recipients} 个收件人
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => startEdit(list)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('确定要删除此列表吗？此操作将同时删除列表中的所有收件人。')) {
                      deleteList(list.id)
                    }
                  }}
                  className="rounded p-1 text-red-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </div>
            {list.description && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {list.description}
              </p>
            )}
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              创建于 {new Date(list.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
        ))}

        {filteredLists.length === 0 && (
          <div className="col-span-full">
            <div className="text-center py-12">
              <List className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                没有找到列表
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm ? '尝试调整搜索条件' : '开始创建您的第一个收件人列表'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}