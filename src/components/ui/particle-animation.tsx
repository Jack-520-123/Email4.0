'use client'

import React, { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  life: number
  maxLife: number
}

interface ParticleAnimationProps {
  status: string
  width?: number
  height?: number
  className?: string
}

const ParticleAnimation: React.FC<ParticleAnimationProps> = ({
  status,
  width = 100,
  height = 60,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const particlesRef = useRef<Particle[]>([])

  const getParticleConfig = (status: string) => {
    switch (status) {
      case 'SENDING':
        return {
          color: '#3B82F6', // 蓝色
          particleCount: 15,
          speed: 2,
          direction: 'up',
          pattern: 'stream'
        }
      case 'COMPLETED':
        return {
          color: '#10B981', // 绿色
          particleCount: 20,
          speed: 3,
          direction: 'burst',
          pattern: 'explosion'
        }
      case 'FAILED':
        return {
          color: '#EF4444', // 红色
          particleCount: 12,
          speed: 1.5,
          direction: 'down',
          pattern: 'rain'
        }
      case 'PAUSED':
        return {
          color: '#F59E0B', // 橙色
          particleCount: 8,
          speed: 0.5,
          direction: 'float',
          pattern: 'gentle'
        }
      case 'DRAFT':
        return {
          color: '#6B7280', // 灰色
          particleCount: 6,
          speed: 0.3,
          direction: 'float',
          pattern: 'subtle'
        }
      case 'SCHEDULED':
        return {
          color: '#F59E0B', // 黄色
          particleCount: 10,
          speed: 1,
          direction: 'pulse',
          pattern: 'waiting'
        }
      case 'STOPPED':
        return {
          color: '#DC2626', // 深红色
          particleCount: 5,
          speed: 0.2,
          direction: 'fade',
          pattern: 'dissipate'
        }
      default:
        return {
          color: '#6B7280',
          particleCount: 0,
          speed: 0,
          direction: 'none',
          pattern: 'none'
        }
    }
  }

  const createParticle = (config: any, canvas: HTMLCanvasElement): Particle => {
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    let x, y, vx, vy

    switch (config.pattern) {
      case 'stream': // 发送中 - 从底部向上流动
        x = centerX + (Math.random() - 0.5) * 30
        y = canvas.height + 10
        vx = (Math.random() - 0.5) * 0.5
        vy = -config.speed * (0.8 + Math.random() * 0.4)
        break
      case 'explosion': // 已完成 - 从中心爆炸
        x = centerX + (Math.random() - 0.5) * 10
        y = centerY + (Math.random() - 0.5) * 10
        const angle = Math.random() * Math.PI * 2
        const speed = config.speed * (0.5 + Math.random() * 0.5)
        vx = Math.cos(angle) * speed
        vy = Math.sin(angle) * speed
        break
      case 'rain': // 失败 - 从上方下落
        x = Math.random() * canvas.width
        y = -10
        vx = (Math.random() - 0.5) * 0.3
        vy = config.speed * (0.8 + Math.random() * 0.4)
        break
      case 'gentle': // 暂停 - 缓慢浮动
        x = Math.random() * canvas.width
        y = Math.random() * canvas.height
        vx = (Math.random() - 0.5) * config.speed
        vy = (Math.random() - 0.5) * config.speed
        break
      case 'subtle': // 草稿 - 轻微浮动
        x = Math.random() * canvas.width
        y = Math.random() * canvas.height
        vx = (Math.random() - 0.5) * config.speed
        vy = (Math.random() - 0.5) * config.speed
        break
      case 'waiting': // 已调度 - 脉冲效果
        x = centerX + (Math.random() - 0.5) * 40
        y = centerY + (Math.random() - 0.5) * 40
        vx = (Math.random() - 0.5) * config.speed
        vy = (Math.random() - 0.5) * config.speed
        break
      case 'dissipate': // 已停止 - 消散效果
        x = Math.random() * canvas.width
        y = Math.random() * canvas.height
        vx = (Math.random() - 0.5) * config.speed
        vy = (Math.random() - 0.5) * config.speed
        break
      default:
        x = centerX
        y = centerY
        vx = 0
        vy = 0
    }

    return {
      x,
      y,
      vx,
      vy,
      size: 2 + Math.random() * 3,
      color: config.color,
      alpha: 0.8 + Math.random() * 0.2,
      life: 0,
      maxLife: 60 + Math.random() * 60
    }
  }

  const updateParticle = (particle: Particle, config: any, canvas: HTMLCanvasElement) => {
    particle.x += particle.vx
    particle.y += particle.vy
    particle.life++

    // 根据不同模式更新粒子行为
    switch (config.pattern) {
      case 'stream':
        // 发送中 - 粒子向上流动，到顶部后重新生成
        if (particle.y < -10) {
          particle.x = canvas.width / 2 + (Math.random() - 0.5) * 30
          particle.y = canvas.height + 10
          particle.life = 0
        }
        break
      case 'explosion':
        // 已完成 - 爆炸后逐渐消失
        particle.alpha = Math.max(0, 1 - particle.life / particle.maxLife)
        break
      case 'rain':
        // 失败 - 粒子下落，到底部后重新生成
        if (particle.y > canvas.height + 10) {
          particle.x = Math.random() * canvas.width
          particle.y = -10
          particle.life = 0
        }
        break
      case 'gentle':
        // 暂停 - 边界反弹
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1
        break
      case 'subtle':
        // 草稿 - 边界反弹，更轻微
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1
        break
      case 'waiting':
        // 已调度 - 脉冲效果
        particle.alpha = 0.5 + 0.3 * Math.sin(particle.life * 0.1)
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1
        break
      case 'dissipate':
        // 已停止 - 逐渐消散
        particle.alpha = Math.max(0, 1 - particle.life / particle.maxLife)
        break
    }

    // 重置生命周期过长的粒子
    if (particle.life > particle.maxLife && config.pattern !== 'explosion' && config.pattern !== 'dissipate') {
      particle.life = 0
      if (config.pattern === 'stream') {
        particle.x = canvas.width / 2 + (Math.random() - 0.5) * 30
        particle.y = canvas.height + 10
      } else if (config.pattern === 'rain') {
        particle.x = Math.random() * canvas.width
        particle.y = -10
      }
    }
  }

  const drawParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    ctx.save()
    ctx.globalAlpha = particle.alpha
    ctx.fillStyle = particle.color
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const animate = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const config = getParticleConfig(status)
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 确保有足够的粒子
    while (particlesRef.current.length < config.particleCount) {
      particlesRef.current.push(createParticle(config, canvas))
    }

    // 移除多余的粒子
    if (particlesRef.current.length > config.particleCount) {
      particlesRef.current = particlesRef.current.slice(0, config.particleCount)
    }

    // 更新和绘制粒子
    particlesRef.current.forEach(particle => {
      updateParticle(particle, config, canvas)
      drawParticle(ctx, particle)
    })

    // 移除已死亡的粒子（仅对爆炸和消散效果）
    if (config.pattern === 'explosion' || config.pattern === 'dissipate') {
      particlesRef.current = particlesRef.current.filter(particle => 
        particle.alpha > 0.01 && particle.life < particle.maxLife
      )
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 设置画布尺寸
    canvas.width = width
    canvas.height = height

    // 重置粒子数组
    particlesRef.current = []

    // 开始动画
    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [status, width, height])

  // 如果状态不需要动画，返回空
  const config = getParticleConfig(status)
  if (config.particleCount === 0) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
      style={{ width, height }}
    />
  )
}

export default ParticleAnimation