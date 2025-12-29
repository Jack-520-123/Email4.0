'use client'

import { useState, useEffect } from 'react'

/**
 * 防抖Hook
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // 设置定时器
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // 清理函数：如果value在delay时间内再次改变，则清除上一个定时器
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * 防抖搜索Hook
 * @param initialValue 初始搜索值
 * @param delay 防抖延迟时间（毫秒），默认300ms
 * @returns [searchTerm, debouncedSearchTerm, setSearchTerm]
 */
export function useDebounceSearch(initialValue: string = '', delay: number = 300) {
  const [searchTerm, setSearchTerm] = useState(initialValue)
  const debouncedSearchTerm = useDebounce(searchTerm, delay)

  return [searchTerm, debouncedSearchTerm, setSearchTerm] as const
}