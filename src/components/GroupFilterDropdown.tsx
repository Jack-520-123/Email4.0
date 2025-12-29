import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Check, X, CheckSquare, Square } from 'lucide-react'

interface GroupFilterDropdownProps {
  availableGroups: string[]
  selectedGroups: string[]
  onGroupsChange: (groups: string[]) => void
  onClose: () => void
  groupCounts?: Record<string, number> // 新增：分组成员数量
  onGroupRename?: (oldName: string, newName: string) => void // 新增：分组重命名
  onGroupDelete?: (groupName: string) => void // 新增：删除空分组
}

export default function GroupFilterDropdown({
  availableGroups,
  selectedGroups,
  onGroupsChange,
  onClose,
  groupCounts = {},
  onGroupRename,
  onGroupDelete
}: GroupFilterDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isSelectAll, setIsSelectAll] = useState(false)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 过滤分组
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return availableGroups
    return availableGroups.filter(group => 
      group.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [availableGroups, searchTerm])

  // 检查是否全选
  useEffect(() => {
    if (filteredGroups.length > 0) {
      const allSelected = filteredGroups.every(group => selectedGroups.includes(group))
      setIsSelectAll(allSelected)
    }
  }, [filteredGroups, selectedGroups])

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // 处理全选/反选
  const handleSelectAll = () => {
    if (isSelectAll) {
      // 反选：从已选择的分组中移除当前过滤的分组
      const newSelected = selectedGroups.filter(group => !filteredGroups.includes(group))
      onGroupsChange(newSelected)
    } else {
      // 全选：将当前过滤的分组添加到已选择的分组中
      const newSelected = [...new Set([...selectedGroups, ...filteredGroups])]
      onGroupsChange(newSelected)
    }
  }

  // 处理单个分组选择
  const handleGroupToggle = (group: string) => {
    if (selectedGroups.includes(group)) {
      onGroupsChange(selectedGroups.filter(g => g !== group))
    } else {
      onGroupsChange([...selectedGroups, group])
    }
  }

  // 清空所有选择
  const handleClearAll = () => {
    onGroupsChange([])
  }

  // 开始编辑分组名称
  const startEditGroup = (groupName: string) => {
    setEditingGroup(groupName)
    setNewGroupName(groupName)
  }

  // 保存分组重命名
  const saveGroupRename = () => {
    if (editingGroup && newGroupName.trim() && newGroupName.trim() !== editingGroup) {
      onGroupRename?.(editingGroup, newGroupName.trim())
    }
    setEditingGroup(null)
    setNewGroupName('')
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingGroup(null)
    setNewGroupName('')
  }

  // 删除空分组
  const handleDeleteEmptyGroup = (groupName: string) => {
    if (groupCounts[groupName] === 0) {
      onGroupDelete?.(groupName)
    }
  }

  return (
    <div 
      ref={dropdownRef}
      className="absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700"
    >
      {/* 搜索框 */}
      <div className="border-b border-gray-200 p-3 dark:border-gray-600">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索分组..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            autoFocus
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-600">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSelectAll}
            className="flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {isSelectAll ? (
              <CheckSquare className="mr-1 h-4 w-4" />
            ) : (
              <Square className="mr-1 h-4 w-4" />
            )}
            {isSelectAll ? '反选当前' : '全选当前'}
          </button>
          {selectedGroups.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              <X className="mr-1 h-4 w-4" />
              清空所有
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {selectedGroups.length > 0 && `已选 ${selectedGroups.length} 个`}
        </div>
      </div>

      {/* 分组列表 */}
      <div className="max-h-64 overflow-y-auto">
        {/* 所有分组选项 */}
        <label className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600">
          <input
            type="checkbox"
            checked={selectedGroups.length === 0}
            onChange={() => onGroupsChange([])}
            className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">所有分组</span>
          {selectedGroups.length === 0 && (
            <Check className="ml-auto h-4 w-4 text-blue-600" />
          )}
        </label>

        {/* 分组选项 */}
        {filteredGroups.length > 0 ? (
          filteredGroups.map((group) => {
            const isSelected = selectedGroups.includes(group)
            const memberCount = groupCounts[group] || 0
            const isEmpty = memberCount === 0
            
            return (
              <div 
                key={group} 
                className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 group"
              >
                {editingGroup === group ? (
                  // 编辑模式
                  <div className="flex items-center w-full space-x-2">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveGroupRename()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      autoFocus
                    />
                    <button
                      onClick={saveGroupRename}
                      className="p-1 text-green-600 hover:text-green-700"
                      title="保存"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1 text-red-600 hover:text-red-700"
                      title="取消"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  // 正常显示模式
                  <>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleGroupToggle(group)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                    />
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span 
                        className={`text-sm truncate ${
                          isEmpty ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                        }`} 
                        title={group}
                      >
                        {group}
                      </span>
                      <div className="flex items-center space-x-2 ml-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isEmpty 
                            ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            : 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                        }`}>
                          {memberCount}
                        </span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    {/* 操作按钮 */}
                    <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onGroupRename && (
                        <button
                          onClick={() => startEditGroup(group)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="重命名分组"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {onGroupDelete && isEmpty && (
                        <button
                          onClick={() => handleDeleteEmptyGroup(group)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="删除空分组"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })
        ) : (
          <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? '未找到匹配的分组' : '暂无分组'}
          </div>
        )}
      </div>

      {/* 底部统计信息 */}
      {availableGroups.length > 0 && (
        <div className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
          共 {availableGroups.length} 个分组
          {searchTerm && filteredGroups.length !== availableGroups.length && (
            <span className="ml-2">（筛选后 {filteredGroups.length} 个）</span>
          )}
        </div>
      )}
    </div>
  )
}