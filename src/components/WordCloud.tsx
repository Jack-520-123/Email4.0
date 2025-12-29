'use client'

import React, { useEffect, useRef } from 'react'
import { WORD_CLOUD_COLORS } from '@/config/colors'

interface WordCloudProps {
  words: Array<{
    text: string
    value: number
    color?: string
  }>
  width?: number
  height?: number
}

const WordCloud: React.FC<WordCloudProps> = ({ words, width = 400, height = 300 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || words.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 清空画布
    ctx.clearRect(0, 0, width, height)

    // 设置画布尺寸
    canvas.width = width
    canvas.height = height

    // 找出最大值用于缩放
    const maxValue = Math.max(...words.map(w => w.value))
    const minValue = Math.min(...words.map(w => w.value))
    
    // 颜色数组
    const colors = WORD_CLOUD_COLORS

    // 计算字体大小和位置
    const placedWords: Array<{
      text: string
      x: number
      y: number
      fontSize: number
      color: string
      width: number
      height: number
    }> = []

    words.forEach((word, index) => {
      // 计算字体大小（基于词频）
      const fontSize = Math.max(
        12,
        Math.min(48, 12 + ((word.value - minValue) / (maxValue - minValue)) * 36)
      )
      
      ctx.font = `${fontSize}px Arial`
      const textMetrics = ctx.measureText(word.text)
      const textWidth = textMetrics.width
      const textHeight = fontSize

      // 尝试找到不重叠的位置
      let x: number, y: number
      let attempts = 0
      const maxAttempts = 100
      
      do {
        x = Math.random() * (width - textWidth)
        y = Math.random() * (height - textHeight) + textHeight
        attempts++
      } while (
        attempts < maxAttempts &&
        placedWords.some(placed => 
          x < placed.x + placed.width &&
          x + textWidth > placed.x &&
          y < placed.y + placed.height &&
          y + textHeight > placed.y
        )
      )

      // 如果找不到合适位置，使用螺旋布局
      if (attempts >= maxAttempts) {
        const centerX = width / 2
        const centerY = height / 2
        let radius = 10
        let angle = 0
        
        while (radius < Math.min(width, height) / 2) {
          x = centerX + radius * Math.cos(angle) - textWidth / 2
          y = centerY + radius * Math.sin(angle)
          
          if (
            x >= 0 && x + textWidth <= width &&
            y >= textHeight && y <= height &&
            !placedWords.some(placed => 
              x < placed.x + placed.width &&
              x + textWidth > placed.x &&
              y < placed.y + placed.height &&
              y + textHeight > placed.y
            )
          ) {
            break
          }
          
          angle += 0.1
          if (angle > 2 * Math.PI) {
            angle = 0
            radius += 5
          }
        }
      }

      const color = word.color || colors[index % colors.length]
      
      placedWords.push({
        text: word.text,
        x,
        y,
        fontSize,
        color,
        width: textWidth,
        height: textHeight
      })
    })

    // 绘制词云
    placedWords.forEach(word => {
      ctx.font = `${word.fontSize}px Arial`
      ctx.fillStyle = word.color
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(word.text, word.x, word.y - word.fontSize)
    })

  }, [words, width, height])

  if (words.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
        style={{ width, height }}
      >
        <p className="text-gray-500 text-sm">暂无数据</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="border rounded-lg bg-white"
        style={{ width, height }}
      />
    </div>
  )
}

export default WordCloud