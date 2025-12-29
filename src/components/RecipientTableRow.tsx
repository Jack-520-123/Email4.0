'use client'

import React from 'react'
import { Check, Square, CheckSquare, Edit, Trash, Mail } from 'lucide-react'

interface Recipient {
  id: string
  name: string
  email: string
  company?: string
  website?: string
  group?: string
  status: string
  recipientList: {
    id: string
    name: string
  }
  createdAt: string
  updatedAt: string
}

interface RecipientTableRowProps {
  index: number
  style: React.CSSProperties
  data: {
    recipients: Recipient[]
    selectedRecipients: string[]
    onSelectRecipient: (id: string, checked: boolean) => void
    onEditRecipient: (recipient: Recipient) => void
    onDeleteRecipient: (id: string) => void
  }
}

export default function RecipientTableRow({ index, style, data }: RecipientTableRowProps) {
  const { recipients, selectedRecipients, onSelectRecipient, onEditRecipient, onDeleteRecipient } = data
  const recipient = recipients[index]
  
  if (!recipient) {
    return null
  }

  const isSelected = selectedRecipients.includes(recipient.id)
  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    BOUNCED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    UNSUBSCRIBED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  }

  return (
    <div
      style={style}
      className={`flex items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
        index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'
      }`}
    >
      {/* 选择框 */}
      <div className="flex-shrink-0 w-12">
        <button
          onClick={() => onSelectRecipient(recipient.id, !isSelected)}
          className="flex items-center justify-center w-6 h-6 rounded border border-gray-300 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600"
        >
          {isSelected ? (
            <CheckSquare className="h-4 w-4 text-blue-600" />
          ) : (
            <Square className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* 序号 */}
      <div className="flex-shrink-0 w-16 text-sm text-gray-500 dark:text-gray-400">
        {index + 1}
      </div>

      {/* 头像 */}
      <div className="flex-shrink-0 w-12">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      {/* 收件人信息 */}
      <div className="flex-1 min-w-0 px-4">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {recipient.name}
        </div>
      </div>

      {/* 邮箱 */}
      <div className="flex-1 min-w-0 px-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {recipient.email}
        </div>
      </div>

      {/* 公司 */}
      <div className="flex-1 min-w-0 px-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {recipient.company || '-'}
        </div>
      </div>

      {/* 网站 */}
      <div className="flex-1 min-w-0 px-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {recipient.website ? (
            <a 
              href={recipient.website.startsWith('http') ? recipient.website : `https://${recipient.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
            >
              {recipient.website}
            </a>
          ) : '-'}
        </div>
      </div>

      {/* 分组 */}
      <div className="flex-1 min-w-0 px-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {recipient.group || '-'}
        </div>
      </div>

      {/* 状态 */}
      <div className="flex-shrink-0 w-24 px-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          statusColors[recipient.status as keyof typeof statusColors] || statusColors.ACTIVE
        }`}>
          {recipient.status === 'ACTIVE' && '正常'}
          {recipient.status === 'INACTIVE' && '未激活'}
          {recipient.status === 'BOUNCED' && '退信'}
          {recipient.status === 'UNSUBSCRIBED' && '已退订'}
        </span>
      </div>

      {/* 操作按钮 */}
      <div className="flex-shrink-0 w-20">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEditRecipient(recipient)}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            title="编辑"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDeleteRecipient(recipient.id)}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            title="删除"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// 表格头部组件
interface RecipientTableHeaderProps {
  isAllSelected: boolean
  onSelectAll: (checked: boolean) => void
}

export function RecipientTableHeader({ isAllSelected, onSelectAll }: RecipientTableHeaderProps) {
  return (
    <div className="flex items-center px-6 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      <div className="flex-shrink-0 w-12">
        <button
          onClick={() => onSelectAll(!isAllSelected)}
          className="flex items-center justify-center w-6 h-6 rounded border border-gray-300 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600"
        >
          {isAllSelected ? (
            <CheckSquare className="h-4 w-4 text-blue-600" />
          ) : (
            <Square className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>
      <div className="flex-shrink-0 w-16">序号</div>
      <div className="flex-shrink-0 w-12">头像</div>
      <div className="flex-1 min-w-0 px-4">收件人</div>
      <div className="flex-1 min-w-0 px-4">邮箱</div>
      <div className="flex-1 min-w-0 px-4">公司</div>
      <div className="flex-1 min-w-0 px-4">网站</div>
      <div className="flex-1 min-w-0 px-4">分组</div>
      <div className="flex-shrink-0 w-24 px-4">状态</div>
      <div className="flex-shrink-0 w-20">操作</div>
    </div>
  )
}