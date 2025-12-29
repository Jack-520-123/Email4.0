'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'

interface VirtualScrollTableProps {
  data: any[]
  itemHeight: number
  height: number
  width?: number | string
  renderItem: (props: { index: number; style: React.CSSProperties; data: any[] }) => React.ReactElement
  onScroll?: (scrollTop: number) => void
}

export default function VirtualScrollTable({
  data,
  itemHeight,
  height,
  width = '100%',
  renderItem,
  onScroll
}: VirtualScrollTableProps) {
  const listRef = useRef<List>(null)

  const handleScroll = (props: any) => {
    onScroll?.(props.scrollTop)
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700">
      <List
        ref={listRef}
        height={height}
        width={width}
        itemCount={data.length}
        itemSize={itemHeight}
        itemData={data}
        onScroll={handleScroll}
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800"
      >
        {renderItem}
      </List>
    </div>
  )
}

// 表格行组件
interface TableRowProps {
  index: number
  style: React.CSSProperties
  data: any[]
}

export function TableRow({ index, style, data }: TableRowProps) {
  const item = data[index]
  
  return (
    <div
      style={style}
      className={`flex items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${
        index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'
      }`}
    >
      {/* 这里可以根据实际需要渲染表格内容 */}
      <div className="flex-1 text-sm text-gray-900 dark:text-white">
        {JSON.stringify(item)}
      </div>
    </div>
  )
}