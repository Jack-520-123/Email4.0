'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
  PlusCircle,
  Search,
  Users,
  Mail,
  Building,
  Edit,
  Trash,
  Loader2,
  Filter,
  Download,
  Upload,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Globe
} from 'lucide-react'
import BreadcrumbNav from '@/components/ui/breadcrumb-nav'
import GroupFilterDropdown from '@/components/GroupFilterDropdown'
import VirtualScrollTable from '@/components/VirtualScrollTable'
import RecipientTableRow, { RecipientTableHeader } from '@/components/RecipientTableRow'
import { useDebounceSearch } from '@/hooks/useDebounce'

interface Recipient {
  id: string
  name: string
  email: string
  company?: string
  website?: string
  group?: string
  status: string
  recipientList: RecipientList
  createdAt: string
  updatedAt: string
}

interface RecipientList {
  id: string
  name: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

export default function RecipientsPage() {
  const { data: session } = useSession()
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipientLists, setRecipientLists] = useState<RecipientList[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, debouncedSearchTerm, setSearchTerm] = useDebounceSearch('', 300)
  const [selectedList, setSelectedList] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]) // 支持多选分组
  const [showGroupFilter, setShowGroupFilter] = useState(false) // 控制分组筛选下拉框显示
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false)
  const [availableGroups, setAvailableGroups] = useState<string[]>([])
  const [selectedGroupForUpload, setSelectedGroupForUpload] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    website: '',
    recipientListId: '',
    group: ''
  })
  const [formLoading, setFormLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null)
  const [selectedGroupName, setSelectedGroupName] = useState('')
  const [groupRecipients, setGroupRecipients] = useState<Recipient[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [groupDeleting, setGroupDeleting] = useState(false) // 分组删除状态
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({}) // 分组成员数量统计
  
  // 视图模式：'normal' 普通视图，'group' 分组视图
  const [viewMode, setViewMode] = useState<'normal' | 'group'>('normal')
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })



  // 获取收件人列表
  const fetchRecipients = useCallback(async (page = currentPage) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)
      if (selectedList) params.append('listId', selectedList)
      if (selectedGroup) params.append('group', selectedGroup)
      // 支持多选分组筛选
      if (selectedGroups.length > 0) {
        selectedGroups.forEach(group => params.append('groups[]', group))
      }
      
      const response = await fetch(`/api/recipients?${params}`)
      if (!response.ok) {
        throw new Error('获取收件人失败')
      }
      const data = await response.json()
      setRecipients(data.recipients || [])
      setPagination(data.pagination || {
        page: 1,
        limit: pageSize,
        total: 0,
        pages: 0
      })
      
      // 提取可用分组
      const groups = [...new Set(
        data.recipients
          .map((r: Recipient) => r.group)
          .filter((g: string) => g && g.trim())
      )] as string[]
      setAvailableGroups(groups)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取收件人失败')
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, debouncedSearchTerm, selectedList, selectedGroup])

  // 获取分组聚合数据
  const fetchGroupedRecipients = useCallback(async (page = currentPage) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)
      if (selectedList) params.append('listId', selectedList)
      
      const response = await fetch(`/api/recipients/groups?${params}`)
      if (!response.ok) {
        throw new Error('获取分组数据失败')
      }
      const data = await response.json()
      setRecipients(data.recipients || [])
      setPagination(data.pagination || {
        page: 1,
        limit: pageSize,
        total: 0,
        pages: 0
      })
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取分组数据失败')
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, debouncedSearchTerm, selectedList])

  // 获取收件人列表
  const fetchRecipientLists = useCallback(async () => {
    try {
      const response = await fetch('/api/recipient-lists')
      if (!response.ok) {
        throw new Error('获取收件人列表失败')
      }
      const data = await response.json()
      setRecipientLists(data.lists || [])
    } catch (err) {
      console.error('获取收件人列表失败:', err)
    }
  }, [])

  const fetchAvailableGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/recipients/groups/names')
      if (response.ok) {
        const data = await response.json()
        setAvailableGroups(data.groups || [])
      }
    } catch (error) {
      console.error('获取分组列表失败:', error)
    }
  }, [])

  // 获取分组统计数据
  const fetchGroupCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/recipients/groups/stats')
      if (response.ok) {
        const data = await response.json()
        setGroupCounts(data.groupCounts || {})
      }
    } catch (error) {
      console.error('获取分组统计失败:', error)
    }
  }, [])

  // 分组重命名
  const handleGroupRename = async (oldName: string, newName: string) => {
    try {
      const response = await fetch('/api/recipients/groups/rename', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldName, newName }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '重命名分组失败')
      }
      
      // 刷新数据
      await Promise.all([
        fetchAvailableGroups(),
        fetchGroupCounts(),
        viewMode === 'group' ? fetchGroupedRecipients() : fetchRecipients()
      ])
      
      // 更新选中的分组
      if (selectedGroups.includes(oldName)) {
        setSelectedGroups(prev => prev.map(g => g === oldName ? newName : g))
      }
      
    } catch (error) {
      alert(error instanceof Error ? error.message : '重命名分组失败')
    }
  }

  // 删除空分组
  const handleDeleteEmptyGroup = async (groupName: string) => {
    if (groupCounts[groupName] > 0) {
      alert('只能删除空分组')
      return
    }
    
    if (!window.confirm(`确定要删除空分组 "${groupName}" 吗？`)) {
      return
    }
    
    try {
      const response = await fetch('/api/recipients/groups/delete-empty', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupName }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除分组失败')
      }
      
      // 刷新数据
      await Promise.all([
        fetchAvailableGroups(),
        fetchGroupCounts(),
        viewMode === 'group' ? fetchGroupedRecipients() : fetchRecipients()
      ])
      
      // 从选中的分组中移除
      setSelectedGroups(prev => prev.filter(g => g !== groupName))
      
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除分组失败')
    }
  }

  // 添加收件人
  const addRecipient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.recipientListId) {
      alert('请填写所有必填字段')
      return
    }

    try {
      setFormLoading(true)
      const response = await fetch('/api/recipients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '添加收件人失败')
      }

      setFormData({ name: '', email: '', company: '', website: '', recipientListId: '', group: '' })
      setShowAddForm(false)
      if (viewMode === 'group') {
        fetchGroupedRecipients()
      } else {
        fetchRecipients()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '添加收件人失败')
    } finally {
      setFormLoading(false)
    }
  }

  // 删除收件人
  const deleteRecipient = async (id: string) => {
    try {
      const response = await fetch(`/api/recipients/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('删除收件人失败')
      }
      if (viewMode === 'group') {
        fetchGroupedRecipients()
      } else {
        fetchRecipients()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除收件人失败')
    }
  }

  // 批量删除收件人
  const batchDeleteRecipients = async () => {
    if (selectedRecipients.length === 0) {
      alert('请选择要删除的收件人')
      return
    }

    if (!window.confirm(`确定要删除选中的 ${selectedRecipients.length} 个收件人吗？此操作不可撤销。`)) {
      return
    }

    setBatchDeleting(true)
    try {
      const response = await fetch('/api/recipients/batch-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedRecipients }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '批量删除失败')
      }

      const result = await response.json()
      
      // 清空选择
      setSelectedRecipients([])
      setIsAllSelected(false)
      
      // 重新获取收件人列表
      if (viewMode === 'group') {
        fetchGroupedRecipients()
      } else {
        fetchRecipients()
      }
      
      // 显示成功消息
      alert(result.message || '批量删除成功')
    } catch (error) {
      console.error('批量删除收件人失败:', error)
      alert(error instanceof Error ? error.message : '批量删除收件人失败')
    } finally {
      setBatchDeleting(false)
    }
  }

  // 按分组删除收件人
  const deleteRecipientsByGroup = async (groupName: string) => {
    if (!window.confirm(`确定要删除整个分组 "${groupName}" 吗？此操作将删除该分组下的所有收件人，且不可撤销。`)) {
      return
    }

    setGroupDeleting(true)
    try {
      const response = await fetch('/api/recipients/delete-by-group', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupName }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除分组失败')
      }
      
      const result = await response.json()
      alert(result.message)
      
      // 刷新数据
      if (viewMode === 'group') {
        fetchGroupedRecipients()
      } else {
        fetchRecipients()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除分组失败')
    } finally {
      setGroupDeleting(false)
    }
  }

  // 处理单个收件人选择
  const handleRecipientSelect = (recipientId: string, checked: boolean) => {
    if (checked) {
      setSelectedRecipients(prev => [...prev, recipientId])
    } else {
      setSelectedRecipients(prev => prev.filter(id => id !== recipientId))
      setIsAllSelected(false)
    }
  }

  // 处理全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    setIsAllSelected(checked)
    if (checked) {
      const currentPageRecipientIds = recipients
        .filter(r => !(viewMode === 'group' && (r as any).isGroup))
        .map(r => r.id)
      setSelectedRecipients(currentPageRecipientIds)
    } else {
      setSelectedRecipients([])
    }
  }

  // 当收件人列表变化时，更新选择状态
  useEffect(() => {
    const currentPageRecipientIds = recipients
      .filter(r => !(viewMode === 'group' && (r as any).isGroup))
      .map(r => r.id)
    
    const selectedInCurrentPage = selectedRecipients.filter(id => 
      currentPageRecipientIds.includes(id)
    )
    
    setIsAllSelected(
      currentPageRecipientIds.length > 0 && 
      selectedInCurrentPage.length === currentPageRecipientIds.length
    )
  }, [recipients, selectedRecipients, viewMode])

  // 下载模板
  const downloadTemplate = (format: 'csv' | 'xlsx' = 'xlsx') => {
    const link = document.createElement('a')
    if (format === 'xlsx') {
      link.href = '/templates/recipients-template.xlsx'
      link.download = 'recipients-template.xlsx'
    } else {
      link.href = '/templates/recipients-template.csv'
      link.download = 'recipients-template.csv'
    }
    link.click()
  }

  // 批量导入收件人
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      alert('请上传CSV或Excel文件')
      return
    }

    // 设置待处理文件并显示分组选择模态框
    setPendingFile(file)
    await fetchAvailableGroups()
    setShowGroupModal(true)
    event.target.value = ''
  }

  const handleGroupSelection = async () => {
    if (!pendingFile) return

    const customGroup = selectedGroupForUpload === 'new' ? newGroupName.trim() : selectedGroupForUpload
    
    setUploading(true)
    setShowGroupModal(false)
    
    const formData = new FormData()
    formData.append('file', pendingFile)
    if (customGroup) {
      formData.append('customGroup', customGroup)
    }

    try {
      const response = await fetch('/api/recipients/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        alert(`批量导入成功，共导入${result.count}个收件人${customGroup ? `，分组：${customGroup}` : ''}`)
        fetchRecipients()
      } else {
        const error = await response.json()
        console.error('批量导入错误:', error)
        alert(`批量导入失败: ${error.error || '未知错误'}${error.details ? '\n详细信息: ' + error.details : ''}`)
      }
    } catch (error) {
      console.error('批量导入异常:', error)
      alert('批量导入失败: 网络错误或服务器异常')
    } finally {
      setUploading(false)
      setPendingFile(null)
      setSelectedGroupForUpload('')
      setNewGroupName('')
    }
  }

  const handleCancelGroupSelection = () => {
    setShowGroupModal(false)
    setPendingFile(null)
    setSelectedGroupForUpload('')
    setNewGroupName('')
  }

  // 分页控制函数
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    if (viewMode === 'group') {
      fetchGroupedRecipients(page)
    } else {
      fetchRecipients(page)
    }
  }, [viewMode, fetchGroupedRecipients, fetchRecipients])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1)
    if (viewMode === 'group') {
      fetchGroupedRecipients(1)
    } else {
      fetchRecipients(1)
    }
  }, [viewMode, fetchGroupedRecipients, fetchRecipients])

  // 重置到第一页的函数
  const resetToFirstPage = useCallback(() => {
    setCurrentPage(1)
    if (viewMode === 'group') {
      fetchGroupedRecipients(1)
    } else {
      fetchRecipients(1)
    }
  }, [viewMode, fetchGroupedRecipients, fetchRecipients])

  // 获取分组内的收件人列表
  const fetchGroupRecipients = useCallback(async (groupName: string) => {
    try {
      setGroupLoading(true)
      const params = new URLSearchParams()
      params.append('limit', '1000') // 获取该分组的所有收件人
      if (selectedList) params.append('listId', selectedList)
      
      const response = await fetch(`/api/recipients/groups/${encodeURIComponent(groupName)}?${params}`)
      if (!response.ok) {
        throw new Error('获取分组收件人失败')
      }
      
      const data = await response.json()
      setGroupRecipients(data.recipients || [])
    } catch (error) {
      console.error('获取分组收件人失败:', error)
      setError('获取分组收件人失败')
    } finally {
      setGroupLoading(false)
    }
  }, [])

  // 监听视图模式变化，清空选择状态并重新获取数据
  useEffect(() => {
    setSelectedRecipients([])
    setIsAllSelected(false)
    setCurrentPage(1)
    if (viewMode === 'group') {
      fetchGroupedRecipients(1)
    } else {
      fetchRecipients(1)
    }
  }, [viewMode])

  useEffect(() => {
    if (session) {
      fetchRecipientLists()
      fetchAvailableGroups()
      fetchGroupCounts()
      if (viewMode === 'group') {
        fetchGroupedRecipients(1)
      } else {
        fetchRecipients(1)
      }
    }
  }, [session, fetchRecipientLists, fetchAvailableGroups, fetchGroupCounts, viewMode])

  // 当搜索条件改变时重置到第一页
  useEffect(() => {
    if (session && (debouncedSearchTerm || selectedList || selectedGroup)) {
      resetToFirstPage()
    }
  }, [session, debouncedSearchTerm, selectedList, selectedGroup, resetToFirstPage])

  if (loading && recipients.length === 0) {
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
          onClick={() => fetchRecipients()}
          className="mt-2 text-sm text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 面包屑导航 */}
      <BreadcrumbNav 
        title="收件人管理"
        customBackPath="/dashboard"
      />
      
      {/* 头部 */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('normal')}
            className={`flex items-center rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              viewMode === 'normal'
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <Users className="mr-2 h-4 w-4" />
            普通视图
          </button>
          <button
            onClick={() => setViewMode('group')}
            className={`flex items-center rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              viewMode === 'group'
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <Filter className="mr-2 h-4 w-4" />
            分组视图
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <button
              onClick={() => downloadTemplate('xlsx')}
              className="flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              <Download className="mr-2 h-4 w-4" />
              下载Excel模板
            </button>
          </div>
          <button
            onClick={() => downloadTemplate('csv')}
            className="flex items-center rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            <Download className="mr-2 h-4 w-4" />
            下载CSV模板
          </button>
          <label className="flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 cursor-pointer">
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? '导入中...' : '批量导入'}
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="sr-only"
            />
          </label>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            添加收件人
          </button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 搜索框 */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="search"
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="搜索收件人..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* 列表筛选 */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Filter className="h-5 w-5 text-gray-400" />
          </div>
          <select
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">所有列表</option>
            {recipientLists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </div>

        {/* 分组筛选 - 支持多选和搜索 */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Users className="h-5 w-5 text-gray-400" />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGroupFilter(!showGroupFilter)}
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-8 text-left text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {selectedGroups.length === 0 
                ? '所有分组' 
                : selectedGroups.length === 1 
                  ? selectedGroups[0] 
                  : `已选择 ${selectedGroups.length} 个分组`
              }
              <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </button>
            {showGroupFilter && (
              <GroupFilterDropdown 
                availableGroups={availableGroups}
                selectedGroups={selectedGroups}
                onGroupsChange={(groups) => {
                  setSelectedGroups(groups)
                  setSelectedGroup('')
                }}
                onClose={() => setShowGroupFilter(false)}
                groupCounts={groupCounts}
                onGroupRename={handleGroupRename}
                onGroupDelete={handleDeleteEmptyGroup}
              />
            )}
          </div>
        </div>
      </div>

      {/* 快速筛选按钮 */}
      {availableGroups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 self-center">快速筛选:</span>
          <button
            onClick={() => {
              setSelectedGroups([])
              setSelectedGroup('')
            }}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              selectedGroups.length === 0
                ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
            }`}
          >
            全部 ({pagination.total})
          </button>
          {availableGroups.slice(0, 8).map((group) => {
            const count = groupCounts[group] || 0
            const isSelected = selectedGroups.includes(group)
            return (
              <button
                key={group}
                onClick={() => {
                  if (isSelected) {
                    setSelectedGroups(selectedGroups.filter(g => g !== group))
                  } else {
                    setSelectedGroups([group])
                  }
                  setSelectedGroup('')
                }}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                }`}
              >
                {group} ({count})
              </button>
            )
          })}
          {availableGroups.length > 8 && (
            <span className="text-xs text-gray-500 self-center">+{availableGroups.length - 8} 更多...</span>
          )}
        </div>
      )}

      {/* 数据统计和批量操作 */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            共 {pagination.total} 条记录，第 {pagination.page} / {pagination.pages} 页
          </div>
          {selectedRecipients.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-600 dark:text-blue-400">
                已选择 {selectedRecipients.length} 项
              </span>
              <button
                onClick={batchDeleteRecipients}
                disabled={batchDeleting}
                className="flex items-center rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash className="mr-1 h-3 w-3" />
                {batchDeleting ? '删除中...' : '批量删除'}
              </button>
            </div>
          )}
          {/* 分组删除功能 */}
          {selectedGroups.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-600 dark:text-green-400">
                已选择分组: {selectedGroups.join(', ')}
              </span>
              <button
                onClick={() => {
                  if (selectedGroups.length === 1) {
                    deleteRecipientsByGroup(selectedGroups[0])
                  } else {
                    // 多个分组时，逐个删除
                    selectedGroups.forEach(group => deleteRecipientsByGroup(group))
                  }
                }}
                disabled={groupDeleting}
                className="flex items-center rounded-md bg-orange-600 px-3 py-1 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                <Trash className="mr-1 h-3 w-3" />
                {groupDeleting ? '删除中...' : '删除分组'}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">每页显示:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-600 dark:text-gray-400">条</span>
        </div>
      </div>

      {/* 添加收件人表单 */}
      {showAddForm && (
        <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">添加收件人</h2>
          <form onSubmit={addRecipient} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                姓名 *
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
                邮箱 *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                公司
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                收件人列表 *
              </label>
              <select
                value={formData.recipientListId}
                onChange={(e) => setFormData({ ...formData, recipientListId: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">选择列表</option>
                {recipientLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                分组
              </label>
              <input
                type="text"
                value={formData.group}
                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                placeholder="可选，用于分组管理"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                主页链接
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="可选，收件人的主页链接"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="md:col-span-2">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {formLoading ? '添加中...' : '添加'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 收件人列表 */}
      <div className="overflow-hidden rounded-lg border bg-white shadow dark:border-gray-700 dark:bg-gray-800">
        {recipients.length > 0 ? (
          <div>
            {/* 表格头部 */}
            <RecipientTableHeader 
              isAllSelected={isAllSelected}
              onSelectAll={handleSelectAll}
            />
            
            {/* 虚拟滚动表格 */}
            <VirtualScrollTable
              data={recipients}
              itemHeight={72}
              height={600}
              renderItem={({ index, style, data }) => (
                <RecipientTableRow
                  index={index}
                  style={style}
                  data={{
                    recipients: data,
                    selectedRecipients,
                    onSelectRecipient: handleRecipientSelect,
                    onEditRecipient: (recipient) => {
                      if (viewMode === 'group' && (recipient as any).isGroup) {
                        setSelectedGroupName(recipient.group!)
                        setShowGroupMembersModal(true)
                        fetchGroupRecipients(recipient.group!)
                      } else if (recipient.group) {
                        setSelectedGroupName(recipient.group)
                        setShowGroupMembersModal(true)
                        fetchGroupRecipients(recipient.group)
                      } else {
                        setSelectedRecipient(recipient)
                        setShowDetailModal(true)
                      }
                    },
                    onDeleteRecipient: (recipientId) => {
                      if (window.confirm('确定要删除此收件人吗？此操作不可撤销。')) {
                        deleteRecipient(recipientId)
                      }
                    }
                  }}
                />
              )}
            />
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            没有找到收件人
          </div>
        )}
      </div>

      {/* 分页组件 */}
      {pagination.pages > 1 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            显示第 {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条记录
          </div>
          
          <div className="flex items-center space-x-2">
            {/* 首页 */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={pagination.page === 1}
              className="rounded p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
              title="首页"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            
            {/* 上一页 */}
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="rounded p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
              title="上一页"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {/* 页码 */}
            <div className="flex items-center space-x-1">
              {(() => {
                const pages = []
                const start = Math.max(1, pagination.page - 2)
                const end = Math.min(pagination.pages, pagination.page + 2)
                
                for (let i = start; i <= end; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => handlePageChange(i)}
                      className={`rounded px-3 py-1 text-sm ${
                        i === pagination.page
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                    >
                      {i}
                    </button>
                  )
                }
                return pages
              })()}
            </div>
            
            {/* 下一页 */}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="rounded p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
              title="下一页"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            
            {/* 末页 */}
            <button
              onClick={() => handlePageChange(pagination.pages)}
              disabled={pagination.page === pagination.pages}
              className="rounded p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
              title="末页"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
            
            {/* 跳转到指定页 */}
            <div className="flex items-center space-x-2 ml-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">跳转到</span>
              <input
                type="number"
                min={1}
                max={pagination.pages}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const page = parseInt((e.target as HTMLInputElement).value)
                    if (page >= 1 && page <= pagination.pages) {
                      handlePageChange(page)
                      ;(e.target as HTMLInputElement).value = ''
                    }
                  }
                }}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">页</span>
            </div>
          </div>
        </div>
      )}

      {/* 收件人详情模态框 */}
      {showDetailModal && selectedRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            {/* 模态框头部 */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  收件人详情
                </h3>
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedRecipient(null)
                  }}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* 模态框内容 */}
            <div className="p-6">
            
            <div className="space-y-4">
              {/* 头像和基本信息 */}
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 flex-shrink-0 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <div className="flex h-full w-full items-center justify-center">
                    <Users className="h-8 w-8" />
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    {selectedRecipient.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    收件人ID: {selectedRecipient.id}
                  </p>
                </div>
              </div>

              {/* 详细信息 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">邮箱地址</p>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedRecipient.email}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">公司</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedRecipient.company || '未填写'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">所属列表</p>
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      {selectedRecipient.recipientList.name}
                    </span>
                  </div>
                </div>

                {selectedRecipient.group && (
                  <div className="flex items-center space-x-3">
                    <Filter className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">分组</p>
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {selectedRecipient.group}
                      </span>
                    </div>
                  </div>
                )}

                {selectedRecipient.website && (
                  <div className="flex items-center space-x-3">
                    <Globe className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">主页链接</p>
                      <a
                        href={selectedRecipient.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                      >
                        {selectedRecipient.website}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <div className="h-5 w-5 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">创建时间</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedRecipient.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
 
            </div>
            
            {/* 模态框底部 */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedRecipient(null)
                  }}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  关闭
                </button>
                <button
                  onClick={() => {
                    // 可以添加编辑功能
                    alert('编辑功能待实现')
                  }}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  编辑
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 分组成员列表模态框 */}
      {showGroupMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-hidden flex flex-col">
            {/* 模态框头部 */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    分组成员列表
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    分组：{selectedGroupName} ({groupRecipients.length} 人)
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowGroupMembersModal(false)
                    setSelectedGroupName('')
                    setGroupRecipients([])
                  }}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* 模态框内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {groupLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
                </div>
              ) : groupRecipients.length > 0 ? (
                <div className="space-y-3">
                  {groupRecipients.map((recipient, index) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                            <span className="text-sm font-medium">{index + 1}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {recipient.name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {recipient.email}
                              </p>
                            </div>
                            {recipient.company && (
                              <div className="hidden sm:block">
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                  {recipient.company}
                                </p>
                              </div>
                            )}
                            <div className="hidden md:block">
                              <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                {recipient.recipientList.name}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedRecipient(recipient)
                            setShowDetailModal(true)
                            setShowGroupModal(false)
                          }}
                          className="rounded p-1 text-blue-500 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30"
                          title="查看详情"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('确定要删除此收件人吗？此操作不可撤销。')) {
                              deleteRecipient(recipient.id)
                              // 重新获取分组数据
                              fetchGroupRecipients(selectedGroupName)
                            }
                          }}
                          className="rounded p-1 text-red-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                          title="删除收件人"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">该分组暂无成员</p>
                </div>
              )}
            </div>
            
            {/* 模态框底部 */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  共 {groupRecipients.length} 名成员
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowGroupModal(false)
                      setSelectedGroupName('')
                      setGroupRecipients([])
                    }}
                    className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    关闭
                  </button>
                  <button
                    onClick={() => {
                      // 可以添加导出功能
                      alert('导出功能待实现')
                    }}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    导出分组
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 分组选择模态框 */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                选择分组
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                为导入的收件人选择分组，或创建新分组
              </p>
            </div>
            
            <div className="px-6 py-4">
              <div className="space-y-4">
                {/* 使用文件中的分组信息 */}
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="groupOption"
                    value=""
                    checked={selectedGroupForUpload === ''}
                    onChange={(e) => setSelectedGroupForUpload(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    使用文件中的分组信息
                  </span>
                </label>
                
                {/* 现有分组选项 */}
                {availableGroups.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      选择现有分组：
                    </p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {availableGroups.map((group) => (
                        <label key={group} className="flex items-center">
                          <input
                            type="radio"
                            name="groupOption"
                            value={group}
                            checked={selectedGroupForUpload === group}
                            onChange={(e) => setSelectedGroupForUpload(e.target.value)}
                            className="mr-3"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {group}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 创建新分组 */}
                <div>
                  <label className="flex items-center mb-2">
                    <input
                      type="radio"
                      name="groupOption"
                      value="new"
                      checked={selectedGroupForUpload === 'new'}
                      onChange={(e) => setSelectedGroupForUpload(e.target.value)}
                      className="mr-3"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      创建新分组
                    </span>
                  </label>
                  {selectedGroupForUpload === 'new' && (
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="请输入新分组名称"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={handleCancelGroupSelection}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                取消
              </button>
              <button
                onClick={handleGroupSelection}
                disabled={selectedGroupForUpload === 'new' && !newGroupName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}