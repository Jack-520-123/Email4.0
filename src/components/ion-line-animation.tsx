'use client'

import React, { useEffect, useRef } from 'react'

interface IonLineAnimationProps {
  status: string
  width?: number
  height?: number
  className?: string
}

interface Ion {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  color: string
  trail: { x: number; y: number; opacity: number }[]
  energy: number
  pulsePhase: number
}

interface ElectricArc {
  startX: number
  startY: number
  endX: number
  endY: number
  intensity: number
  life: number
  maxLife: number
}

export function IonLineAnimation({ 
  status, 
  width = 300, 
  height = 60, 
  className = '' 
}: IonLineAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const ionsRef = useRef<Ion[]>([])
  const arcsRef = useRef<ElectricArc[]>([])
  const timeRef = useRef<number>(0)

  // 根据状态获取配置
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'SENDING':
        return {
          ionCount: 20,
          baseColor: '#3b82f6', // 蓝色
          secondaryColor: '#60a5fa',
          speed: 3.5,
          glowIntensity: 1.2,
          trailLength: 12,
          sparkles: true,
          electricArcs: true,
          energyField: true,
          pulseWaves: true,
          opacity: 0.9
        }
      case 'COMPLETED':
        return {
          ionCount: 15,
          baseColor: '#10b981', // 绿色
          secondaryColor: '#34d399',
          speed: 2.2,
          glowIntensity: 0.8,
          trailLength: 8,
          sparkles: true,
          electricArcs: false,
          energyField: true,
          pulseWaves: false,
          opacity: 0.7
        }
      case 'FAILED':
        return {
          ionCount: 10,
          baseColor: '#ef4444', // 红色
          secondaryColor: '#f87171',
          speed: 1.5,
          glowIntensity: 0.6,
          trailLength: 6,
          sparkles: false,
          electricArcs: true,
          energyField: false,
          pulseWaves: false,
          opacity: 0.6
        }
      case 'PAUSED':
        return {
          ionCount: 8,
          baseColor: '#f59e0b', // 黄色
          secondaryColor: '#fbbf24',
          speed: 1.0,
          glowIntensity: 0.4,
          trailLength: 4,
          sparkles: false,
          electricArcs: false,
          energyField: true,
          pulseWaves: false,
          opacity: 0.5
        }
      case 'SCHEDULED':
        return {
          ionCount: 12,
          baseColor: '#8b5cf6', // 紫色
          secondaryColor: '#a78bfa',
          speed: 2.0,
          glowIntensity: 0.7,
          trailLength: 6,
          sparkles: true,
          electricArcs: false,
          energyField: true,
          pulseWaves: true,
          opacity: 0.6
        }
      case 'STOPPED':
        return {
          ionCount: 6,
          baseColor: '#6b7280', // 灰色
          secondaryColor: '#9ca3af',
          speed: 0.8,
          glowIntensity: 0.3,
          trailLength: 3,
          sparkles: false,
          electricArcs: false,
          energyField: false,
          pulseWaves: false,
          opacity: 0.4
        }
      default:
        return {
          ionCount: 5,
          baseColor: '#6b7280', // 灰色
          secondaryColor: '#9ca3af',
          speed: 1.0,
          glowIntensity: 0.2,
          trailLength: 3,
          sparkles: false,
          electricArcs: false,
          energyField: false,
          pulseWaves: false,
          opacity: 0.3
        }
    }
  }

  // 初始化离子
  const initializeIons = (config: ReturnType<typeof getStatusConfig>) => {
    const ions: Ion[] = []
    
    for (let i = 0; i < config.ionCount; i++) {
      ions.push({
        x: Math.random() * -150, // 从左侧开始
        y: height / 2 + (Math.random() - 0.5) * 30, // 中心线附近
        vx: config.speed + Math.random() * 2,
        vy: (Math.random() - 0.5) * 0.8,
        size: 2 + Math.random() * 4,
        opacity: 0.6 + Math.random() * 0.4,
        color: Math.random() > 0.7 ? config.secondaryColor : config.baseColor,
        trail: [],
        energy: Math.random(),
        pulsePhase: Math.random() * Math.PI * 2
      })
    }
    
    return ions
  }

  // 创建电弧
  const createElectricArc = (ion1: Ion, ion2: Ion) => {
    const distance = Math.sqrt((ion1.x - ion2.x) ** 2 + (ion1.y - ion2.y) ** 2)
    if (distance < 80 && Math.random() < 0.05) {
      arcsRef.current.push({
        startX: ion1.x,
        startY: ion1.y,
        endX: ion2.x,
        endY: ion2.y,
        intensity: 0.5 + Math.random() * 0.5,
        life: 0,
        maxLife: 10 + Math.random() * 10
      })
    }
  }

  // 更新离子位置
  const updateIons = (ions: Ion[], config: ReturnType<typeof getStatusConfig>) => {
    timeRef.current += 0.02

    ions.forEach((ion, index) => {
      // 更新轨迹
      ion.trail.unshift({ x: ion.x, y: ion.y, opacity: ion.opacity })
      if (ion.trail.length > config.trailLength) {
        ion.trail.pop()
      }

      // 更新脉冲相位
      ion.pulsePhase += 0.1
      ion.energy = 0.5 + 0.5 * Math.sin(ion.pulsePhase)

      // 更新X位置（水平移动）
      ion.x += ion.vx

      // 螺旋形运动：围绕中心线旋转
      const centerY = height / 2
      const spiralRadius = 8 + Math.sin(ion.x * 0.01) * 4 // 螺旋半径随距离变化
      const spiralFrequency = 0.03 + config.speed * 0.005 // 螺旋频率
      const spiralPhase = ion.x * spiralFrequency + index * 0.5 // 每个离子的相位偏移
      
      // 计算螺旋Y坐标
      ion.y = centerY + Math.sin(spiralPhase) * spiralRadius

      // 状态特定的运动模式
      if (status === 'SENDING') {
        // 发送中：更紧密的螺旋，更快的旋转
        const sendingSpiralRadius = 12 + Math.sin(ion.x * 0.015) * 6
        const sendingFrequency = 0.04 + config.speed * 0.008
        const sendingPhase = ion.x * sendingFrequency + index * 0.3
        ion.y = centerY + Math.sin(sendingPhase) * sendingSpiralRadius
        
        // 添加轻微的随机扰动
        ion.y += (Math.random() - 0.5) * 2
        ion.vx += (Math.random() - 0.5) * 0.05
      } else if (status === 'FAILED') {
        // 失败：不规则的螺旋，带抖动
        const failedSpiralRadius = 6 + Math.sin(ion.x * 0.02) * 8
        const failedFrequency = 0.025
        const failedPhase = ion.x * failedFrequency + index * 0.8 + Math.random() * 0.5
        ion.y = centerY + Math.sin(failedPhase) * failedSpiralRadius
        
        // 添加不规则抖动
        ion.x += (Math.random() - 0.5) * 1.5
        ion.y += (Math.random() - 0.5) * 3
      } else if (status === 'PAUSED') {
        // 暂停：缓慢的螺旋
        const pausedSpiralRadius = 5 + Math.sin(ion.x * 0.008) * 3
        const pausedFrequency = 0.02
        const pausedPhase = ion.x * pausedFrequency + index * 0.6
        ion.y = centerY + Math.sin(pausedPhase) * pausedSpiralRadius
      } else if (status === 'COMPLETED') {
        // 完成：平滑的螺旋
        const completedSpiralRadius = 10 + Math.sin(ion.x * 0.012) * 4
        const completedFrequency = 0.035
        const completedPhase = ion.x * completedFrequency + index * 0.4
        ion.y = centerY + Math.sin(completedPhase) * completedSpiralRadius
      } else {
        // 默认：简单的螺旋
        const defaultSpiralRadius = 6 + Math.sin(ion.x * 0.01) * 2
        const defaultFrequency = 0.025
        const defaultPhase = ion.x * defaultFrequency + index * 0.5
        ion.y = centerY + Math.sin(defaultPhase) * defaultSpiralRadius
      }

      // 重置离子位置（循环效果）
      if (ion.x > width + 100) {
        ion.x = Math.random() * -150
        ion.y = height / 2 + (Math.random() - 0.5) * 30
        ion.vx = config.speed + Math.random() * 2
        ion.color = Math.random() > 0.7 ? config.secondaryColor : config.baseColor
      }

      // 边界检查（确保螺旋不超出边界）
      if (ion.y < 5) ion.y = 5
      if (ion.y > height - 5) ion.y = height - 5

      // 创建电弧效果
      if (config.electricArcs && index < ions.length - 1) {
        createElectricArc(ion, ions[index + 1])
      }
    })

    // 更新电弧
    arcsRef.current = arcsRef.current.filter(arc => {
      arc.life++
      return arc.life < arc.maxLife
    })
  }

  // 绘制电弧
  const drawElectricArcs = (ctx: CanvasRenderingContext2D, config: ReturnType<typeof getStatusConfig>) => {
    arcsRef.current.forEach(arc => {
      const progress = arc.life / arc.maxLife
      const opacity = (1 - progress) * arc.intensity * config.opacity

      ctx.globalAlpha = opacity
      ctx.strokeStyle = config.baseColor
      ctx.lineWidth = 2 + Math.random() * 2
      ctx.shadowColor = config.baseColor
      ctx.shadowBlur = 10

      ctx.beginPath()
      
      // 创建锯齿状电弧
      const segments = 5
      const dx = (arc.endX - arc.startX) / segments
      const dy = (arc.endY - arc.startY) / segments
      
      ctx.moveTo(arc.startX, arc.startY)
      
      for (let i = 1; i <= segments; i++) {
        const x = arc.startX + dx * i + (Math.random() - 0.5) * 10
        const y = arc.startY + dy * i + (Math.random() - 0.5) * 10
        ctx.lineTo(x, y)
      }
      
      ctx.stroke()
      ctx.shadowBlur = 0
    })
  }

  // 绘制能量场
  const drawEnergyField = (ctx: CanvasRenderingContext2D, config: ReturnType<typeof getStatusConfig>) => {
    const fieldIntensity = 0.1 * config.opacity
    
    // 创建径向渐变
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) / 2
    )
    
    gradient.addColorStop(0, `${config.baseColor}${Math.floor(fieldIntensity * 255).toString(16).padStart(2, '0')}`)
    gradient.addColorStop(0.5, `${config.secondaryColor}${Math.floor(fieldIntensity * 0.5 * 255).toString(16).padStart(2, '0')}`)
    gradient.addColorStop(1, 'transparent')
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  // 绘制脉冲波
  const drawPulseWaves = (ctx: CanvasRenderingContext2D, config: ReturnType<typeof getStatusConfig>) => {
    const waveCount = 3
    const time = timeRef.current
    
    for (let i = 0; i < waveCount; i++) {
      const wavePhase = (time * 2 + i * Math.PI * 0.8) % (Math.PI * 2)
      const waveProgress = Math.sin(wavePhase)
      
      if (waveProgress > 0) {
        const waveX = (waveProgress * width) - 50
        const waveOpacity = (1 - Math.abs(waveProgress - 0.5) * 2) * 0.3 * config.opacity
        
        ctx.globalAlpha = waveOpacity
        ctx.strokeStyle = config.baseColor
        ctx.lineWidth = 3
        ctx.shadowColor = config.baseColor
        ctx.shadowBlur = 15
        
        ctx.beginPath()
        ctx.moveTo(waveX, 0)
        ctx.lineTo(waveX, height)
        ctx.stroke()
        
        ctx.shadowBlur = 0
      }
    }
  }

  // 渲染离子和效果
  const renderIons = (
    ctx: CanvasRenderingContext2D, 
    ions: Ion[], 
    config: ReturnType<typeof getStatusConfig>
  ) => {
    ctx.clearRect(0, 0, width, height)

    // 绘制能量场背景
    if (config.energyField) {
      drawEnergyField(ctx, config)
    }

    // 绘制主线条（背景）
    ctx.globalAlpha = 0.3 * config.opacity
    ctx.strokeStyle = config.baseColor
    ctx.lineWidth = 2
    ctx.shadowColor = config.baseColor
    ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()
    ctx.shadowBlur = 0

    // 绘制脉冲波
    if (config.pulseWaves) {
      drawPulseWaves(ctx, config)
    }

    // 绘制电弧
    if (config.electricArcs) {
      drawElectricArcs(ctx, config)
    }

    ions.forEach(ion => {
      // 绘制轨迹
      if (ion.trail.length > 1) {
        ctx.strokeStyle = ion.color
        ctx.lineWidth = 2
        
        ctx.beginPath()
        ctx.moveTo(ion.trail[0].x, ion.trail[0].y)
        
        for (let i = 1; i < ion.trail.length; i++) {
          const trailOpacity = (1 - i / ion.trail.length) * 0.6 * config.opacity
          ctx.globalAlpha = trailOpacity
          ctx.lineTo(ion.trail[i].x, ion.trail[i].y)
        }
        ctx.stroke()
      }

      // 绘制外层发光效果
      if (config.glowIntensity > 0) {
        const glowSize = ion.size * (2 + ion.energy)
        ctx.globalAlpha = config.glowIntensity * 0.4 * config.opacity
        ctx.fillStyle = ion.color
        ctx.shadowColor = ion.color
        ctx.shadowBlur = 20
        ctx.beginPath()
        ctx.arc(ion.x, ion.y, glowSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // 绘制中层光环
      ctx.globalAlpha = 0.6 * config.opacity
      ctx.fillStyle = ion.color
      ctx.shadowColor = ion.color
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(ion.x, ion.y, ion.size * 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // 绘制离子核心
      ctx.globalAlpha = ion.opacity * config.opacity
      ctx.fillStyle = ion.color
      ctx.beginPath()
      ctx.arc(ion.x, ion.y, ion.size, 0, Math.PI * 2)
      ctx.fill()

      // 绘制内核高光
      ctx.globalAlpha = 0.9
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(ion.x - ion.size * 0.3, ion.y - ion.size * 0.3, ion.size * 0.5, 0, Math.PI * 2)
      ctx.fill()

      // 绘制能量脉冲环
      if (status === 'SENDING' || status === 'SCHEDULED') {
        const pulseRadius = ion.size * (2 + ion.energy * 2)
        ctx.globalAlpha = (0.3 + ion.energy * 0.4) * config.opacity
        ctx.strokeStyle = ion.color
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(ion.x, ion.y, pulseRadius, 0, Math.PI * 2)
        ctx.stroke()
      }

      // 绘制火花效果（增强版）
      if (config.sparkles && Math.random() < 0.15) {
        const sparkleCount = 2 + Math.floor(Math.random() * 3)
        for (let i = 0; i < sparkleCount; i++) {
          ctx.globalAlpha = 0.8 * config.opacity
          ctx.fillStyle = '#ffffff'
          const sparkleSize = Math.random() * 3
          const sparkleDistance = 5 + Math.random() * 15
          const sparkleAngle = Math.random() * Math.PI * 2
          const sparkleX = ion.x + Math.cos(sparkleAngle) * sparkleDistance
          const sparkleY = ion.y + Math.sin(sparkleAngle) * sparkleDistance
          
          ctx.beginPath()
          ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    })

    ctx.globalAlpha = 1
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 设置画布尺寸
    canvas.width = width
    canvas.height = height

    const config = getStatusConfig(status)
    ionsRef.current = initializeIons(config)
    arcsRef.current = []
    timeRef.current = 0

    const animate = () => {
      updateIons(ionsRef.current, config)
      renderIons(ctx, ionsRef.current, config)
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [status, width, height])

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    </div>
  )
}