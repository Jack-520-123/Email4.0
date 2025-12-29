'use client'

import { useEffect, useRef } from 'react'

// 全局标志，防止多个组件实例重复初始化
let globalInitialized = false

export default function AppInitializer() {
  const initRef = useRef(false)

  useEffect(() => {
    // 防止重复初始化
    if (initRef.current || globalInitialized) {
      console.log('[Client] 应用已初始化，跳过重复初始化')
      return
    }

    initRef.current = true
    globalInitialized = true

    // 在客户端挂载时调用初始化API
    const initializeApp = async () => {
      try {
        // 先检查是否已经初始化
        console.log('[Client] 检查应用初始化状态...')
        const checkResponse = await fetch('/api/initialize', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (checkResponse.ok) {
          const checkResult = await checkResponse.json()
          if (checkResult.initialized) {
            console.log('[Client] 应用已初始化，无需重复初始化')
            return
          }
        }

        console.log('[Client] 调用应用初始化API...')
        const response = await fetch('/api/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const result = await response.json()
          console.log('[Client] 应用初始化成功:', result)
        } else {
          console.error('[Client] 应用初始化失败:', response.statusText)
          // 重置标志，允许重试
          initRef.current = false
          globalInitialized = false
        }
      } catch (error) {
        console.error('[Client] 应用初始化错误:', error)
        // 重置标志，允许重试
        initRef.current = false
        globalInitialized = false
      }
    }

    // 延迟1秒后执行，确保应用完全加载
    const timer = setTimeout(initializeApp, 1000)
    
    return () => {
      clearTimeout(timer)
      // 组件卸载时不重置全局标志，保持初始化状态
    }
  }, [])

  return null // 这个组件不渲染任何内容
}