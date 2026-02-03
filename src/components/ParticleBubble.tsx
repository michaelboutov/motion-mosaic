'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  // Position (Cylindrical-ish)
  angle: number      // Theta
  radius: number     // R
  z: number          // Depth (-1 to 1)

  // Velocity (Physics state)
  vAngle: number
  vRadius: number
  vZ: number

  // Properties
  baseSpeed: number     // Orbital velocity base
  turbulence: number    // Susceptibility to noise forces
  drag: number          // 0.0 to 1.0 (friction)
  
  // Visuals
  size: number
  colorVar: number
}

export default function ParticleBubble() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let animationFrameId: number
    const particles: Particle[] = []
    const PARTICLE_COUNT = 200
    let time = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const initParticles = () => {
      particles.length = 0
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Distribution: Bias towards center (Event Horizon) but allow far strays
        // Using power law distribution for density
        const rRandom = Math.pow(Math.random(), 2.5) 
        
        // 10% very tight core (Event Horizon), 90% drift
        // Radius: 10px to 400px
        const radius = rRandom * 400 + 10
        const isCore = radius < 80

        particles.push({
          angle: Math.random() * Math.PI * 2,
          radius,
          z: (Math.random() - 0.5) * 2,
          
          // Velocity Init
          vAngle: 0,
          vRadius: 0,
          vZ: 0,

          // Physics Properties
          // Core: High speed orbit, low turbulence, low drag (conservation of momentum)
          // Outer: Slow orbit, high turbulence, high drag (viscous fluid)
          baseSpeed: isCore 
            ? (0.05 / (radius/20)) * (Math.random() > 0.5 ? 1 : 0.8) 
            : 0.002 * (Math.random() > 0.5 ? 1 : -0.5),
            
          turbulence: isCore ? 0.05 : 0.8 + Math.random() * 0.5,
          drag: isCore ? 0.98 : 0.95, // Outer particles feel more "water resistance"
          
          // Visuals
          size: Math.random() * 1.5 + 0.5,
          colorVar: Math.random()
        })
      }
    }

    const draw = () => {
      // 1. Trail Effect (Motion Blur)
      // Dark Zinc background with slight transparency for trails
      ctx.fillStyle = 'rgba(9, 9, 11, 0.25)' 
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const cx = canvas.width / 2
      const cy = canvas.height / 2 - 50

      // 2. Dynamic Container Boundary
      const getBoundaryRadius = (angle: number) => {
        const t = time * 0.5
        // Organic blob shape
        return 320 + 
          Math.sin(angle * 3 + t) * 30 + 
          Math.cos(angle * 5 - t * 0.8) * 20
      }

      particles.sort((a, b) => a.z - b.z)

      ctx.save()
      ctx.translate(cx, cy)

      // Time variables for noise fields
      const tx = time * 0.3
      const ty = time * 0.3
      const tz = time * 0.2

      particles.forEach(p => {
        // --- PHYSICS INTEGRATION ---

        // 1. Calculate Forces (Noise Field)
        // Simulating 3D curl noise / turbulence
        const nx = Math.sin(tx + p.radius * 0.01 + p.z)
        const ny = Math.cos(ty + p.angle * 2)
        const nz = Math.sin(tz + p.radius * 0.02)

        // 2. Apply Acceleration to Velocity
        // Tangential force (swirl)
        p.vAngle += (ny * 0.001) * p.turbulence
        // Radial force (expansion/contraction)
        p.vRadius += (nx * 0.5) * p.turbulence
        // Z force (depth drift)
        p.vZ += (nz * 0.01) * p.turbulence

        // 3. Apply Base Orbital Motion
        p.angle += p.baseSpeed

        // 4. Apply Drag (Damping)
        p.vAngle *= p.drag
        p.vRadius *= p.drag
        p.vZ *= p.drag

        // 5. Update Position
        p.angle += p.vAngle
        p.radius += p.vRadius
        p.z += p.vZ

        // --- CONSTRAINTS ---

        // Boundary Spring Force
        // Keep particles loosely inside the morphing bubble
        const boundary = getBoundaryRadius(p.angle)
        
        // Event Horizon (Center) Repulsion
        // Don't let them collapse into a singularity
        if (p.radius < 10) {
          p.vRadius += 0.5
        }

        // Outer Containment
        if (p.radius > boundary) {
          // Soft elastic collision
          const force = (p.radius - boundary) * 0.02
          p.vRadius -= force
        } else if (p.radius > boundary + 50) {
           // Hard limit for strays
           p.radius = boundary + 50
           p.vRadius *= -0.5
        }

        // Z-Cycling (Infinite depth illusion)
        if (p.z > 1) {
          p.z = -1
          // Reset velocity on wrap to prevent energy buildup
          p.vZ *= 0.1 
        } else if (p.z < -1) {
          p.z = 1
          p.vZ *= 0.1
        }

        // --- RENDERING ---

        // Perspective Projection
        const fov = 450
        // Parallax scale
        const scale = fov / (fov - p.z * 150)
        
        const px = Math.cos(p.angle) * p.radius * scale
        const py = Math.sin(p.angle) * p.radius * scale
        
        const renderSize = p.size * scale
        // Fade deep particles
        const alpha = Math.max(0, (p.z + 1.5) / 2.5) 
        
        ctx.beginPath()
        ctx.arc(px, py, renderSize, 0, Math.PI * 2)
        
        // Complex Coloring
        // Depth-based lighting + gold variation
        const depth = (p.z + 1) / 2
        // Base Gold: 255, 215, 0
        // Shadow: 80, 50, 0
        const r = 255
        const g = Math.floor(160 + depth * 80 + p.colorVar * 15)
        const b = Math.floor(20 + depth * 100 + p.colorVar * 10)
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
        ctx.fill()
        
        // Add glow to "foreground" particles for depth of field effect
        if (p.z > 0.4) {
          ctx.shadowBlur = 12 * scale
          ctx.shadowColor = `rgba(255, 200, 50, ${alpha * 0.4})`
        } else {
          ctx.shadowBlur = 0
        }
      })

      ctx.restore()

      time += 0.01
      animationFrameId = requestAnimationFrame(draw)
    }

    resize()
    initParticles()
    draw()

    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-0 pointer-events-none"
    />
  )
}
