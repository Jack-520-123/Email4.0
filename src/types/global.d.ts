// 全局类型声明
declare global {
  var runningTasks: Map<string, { 
    isRunning: boolean
    isPaused: boolean
    controller: AbortController
    lastProcessedIndex: number
  }> | undefined
  
  var warmupTasks: Map<string, any> | undefined
}

export {}