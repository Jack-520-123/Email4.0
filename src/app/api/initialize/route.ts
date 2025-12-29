import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, isAppInitialized } from '@/lib/app-initializer'

export async function POST(request: NextRequest) {
  try {
    console.log('[API] 收到应用初始化请求')
    
    // 检查是否已经初始化
    if (isAppInitialized()) {
      console.log('[API] 应用已经初始化，跳过')
      return NextResponse.json({ 
        success: true, 
        message: '应用已经初始化',
        alreadyInitialized: true 
      })
    }
    
    // 执行初始化
    await initializeApp()
    
    console.log('[API] 应用初始化完成')
    return NextResponse.json({ 
      success: true, 
      message: '应用初始化成功',
      alreadyInitialized: false 
    })
  } catch (error) {
    console.error('[API] 应用初始化失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '初始化失败' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    initialized: isAppInitialized(),
    message: isAppInitialized() ? '应用已初始化' : '应用未初始化'
  })
}