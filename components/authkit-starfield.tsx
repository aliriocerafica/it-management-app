"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { useTheme } from "next-themes"

const subscribeNever = () => () => {}

type Star = {
  x: number
  y: number
  speed: number
  radius: number
  twinkle: number
}

export function AuthKitStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )
  const active =
    mounted && (theme === "authkit" || theme === "authkit-sharp")

  useEffect(() => {
    if (!active) return
    const surface = canvasRef.current
    const context = surface?.getContext("2d")
    if (!surface || !context) return
    return startStarfield(surface, context)
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-50"
    />
  )
}

function startStarfield(
  surface: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let stars: Star[] = []
    let raf = 0
    let running = true

    function size() {
      const width = window.innerWidth
      const height = window.innerHeight
      surface.width = Math.floor(width * dpr)
      surface.height = Math.floor(height * dpr)
      surface.style.width = `${width}px`
      surface.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round((width * height) / 7200)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 0.12 + Math.random() * 0.42,
        radius: Math.random() < 0.12 ? 1.35 : 0.45 + Math.random() * 0.7,
        twinkle: Math.random() * Math.PI * 2,
      }))
    }

    function paint(moving: boolean) {
      const width = window.innerWidth
      const height = window.innerHeight
      context.clearRect(0, 0, width, height)
      for (const star of stars) {
        if (moving) {
          star.y -= star.speed
          star.twinkle += 0.018
          if (star.y < -2) {
            star.y = height + 2
            star.x = Math.random() * width
          }
        }
        const alpha = 0.28 + 0.5 * (star.radius / 1.35) + 0.22 * Math.sin(star.twinkle)
        context.fillStyle = `rgba(210, 226, 255, ${alpha})`
        context.beginPath()
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        context.fill()
      }
    }

    size()
    window.addEventListener("resize", size)

    if (reduce) {
      paint(false)
      return () => window.removeEventListener("resize", size)
    }

    function tick() {
      if (!running) return
      paint(true)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", size)
    }
}
