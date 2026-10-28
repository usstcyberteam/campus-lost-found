import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  computeTargetRadii,
  encodeRecipe,
  makeRandom,
  smoothClosedPath,
  springStep,
  type BlobPoint,
  type BlobRecipe,
  type BlobShape,
} from './blobMath'
import styles from './BlobStudio.module.css'

const POINT_COUNT = 8
const STIFFNESS = 120
const DAMPING = 12

const PALETTES: string[][] = [
  ['#b8301e', '#f2c94c'],
  ['#2f5d8a', '#9db8d6'],
  ['#2a2622', '#776b5b'],
  ['#b8955a', '#f2c94c'],
]

const SHAPES: { key: BlobShape; label: string }[] = [
  { key: 'soft', label: '圆润' },
  { key: 'liquid', label: '液态' },
  { key: 'star', label: '星形' },
]

const SHAPE_FACTOR: Record<BlobShape, { amplitude: number; frequency: number }> = {
  soft: { amplitude: 0.05, frequency: 2 },
  liquid: { amplitude: 0.16, frequency: 2 },
  star: { amplitude: 0.28, frequency: 4 },
}

export interface BlobStudioProps {
  /** card：可交互卡片（含控件）；backdrop：纯装饰背景层（无交互、不遮挡内容） */
  variant?: 'card' | 'backdrop'
  ariaLabel?: string
}

const INITIAL_RADII = new Array(POINT_COUNT).fill(1)

export default function BlobStudio({ variant = 'card', ariaLabel = '可拖拽塑形的 Blob 装饰' }: BlobStudioProps) {
  const interactive = variant === 'card'
  const stageRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const pointerRef = useRef({ x: 0, y: 0, active: false, dragging: false })
  const motionRef = useRef({ radii: [...INITIAL_RADII], velocities: new Array(POINT_COUNT).fill(0) })
  const phaseRef = useRef<number[]>(new Array(POINT_COUNT).fill(0))
  const reducedRef = useRef(false)
  const frameRef = useRef<number | null>(null)
  const lastRef = useRef(0)

  const [shape, setShape] = useState<BlobShape>('liquid')
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [size, setSize] = useState(1)
  const [seed, setSeed] = useState(7)
  const [notice, setNotice] = useState('')

  const recipe: BlobRecipe = useMemo(
    () => ({ shape, palette: paletteIndex, size, seed }),
    [shape, paletteIndex, size, seed],
  )
  const colors = PALETTES[paletteIndex] ?? PALETTES[0]

  // 相位由随机种子决定：相同种子得到相同形态
  useEffect(() => {
    const random = makeRandom(seed)
    phaseRef.current = Array.from({ length: POINT_COUNT }, () => random() * Math.PI * 2)
  }, [seed])

  const draw = useCallback(
    (dt: number, time: number) => {
      const path = pathRef.current
      const { w, h } = sizeRef.current
      if (!path || w <= 0 || h <= 0) return
      const cx = w / 2
      const cy = h / 2
      const base = Math.min(w, h) * 0.34 * size
      const factor = SHAPE_FACTOR[shape] ?? SHAPE_FACTOR.liquid
      const targets = computeTargetRadii(base, factor.amplitude, phaseRef.current, time, factor.frequency)
      const motion = motionRef.current
      const pointer = pointerRef.current
      const pointerAngle = pointer.active ? Math.atan2(pointer.y - cy, pointer.x - cx) : 0
      const points: BlobPoint[] = []
      for (let i = 0; i < POINT_COUNT; i += 1) {
        const angle = (i / POINT_COUNT) * Math.PI * 2 - Math.PI / 2
        let target = targets[i]
        if (interactive && pointer.active) {
          const align = Math.cos(angle - pointerAngle)
          const strength = pointer.dragging ? 0.4 : 0.18
          target += base * strength * Math.max(align, 0)
        }
        const next = springStep(motion.radii[i], target, motion.velocities[i], STIFFNESS, DAMPING, dt)
        motion.radii[i] = next.value
        motion.velocities[i] = next.velocity
        points.push({
          x: cx + Math.cos(angle) * motion.radii[i],
          y: cy + Math.sin(angle) * motion.radii[i],
        })
      }
      path.setAttribute('d', smoothClosedPath(points))
    },
    [interactive, shape, size],
  )

  // 尺寸跟随容器变化
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const update = () => {
      const rect = stage.getBoundingClientRect()
      sizeRef.current = { w: rect.width, h: rect.height }
      draw(reducedRef.current ? 0.016 : 0.016, performance.now() / 1000)
    }
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [draw])

  // 动画循环：尊重 prefers-reduced-motion，页面隐藏时暂停，卸载时彻底清理
  useEffect(() => {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    reducedRef.current = media?.matches ?? false

    const loop = (now: number) => {
      if (document.hidden) {
        frameRef.current = requestAnimationFrame(loop)
        return
      }
      const dt = lastRef.current ? Math.min((now - lastRef.current) / 1000, 1 / 30) : 1 / 60
      lastRef.current = now
      draw(dt, now / 1000)
      frameRef.current = requestAnimationFrame(loop)
    }

    const start = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      lastRef.current = 0
      if (reducedRef.current) {
        draw(1 / 60, 0)
        return
      }
      frameRef.current = requestAnimationFrame(loop)
    }

    const onMotionChange = () => {
      reducedRef.current = media?.matches ?? false
      start()
    }

    start()
    media?.addEventListener('change', onMotionChange)
    document.addEventListener('visibilitychange', start)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      media?.removeEventListener('change', onMotionChange)
      document.removeEventListener('visibilitychange', start)
    }
  }, [draw])

  // 形态/尺寸/配色变化时在静态模式下立即重绘（动画模式下由 RAF 自然接管）
  useEffect(() => {
    if (reducedRef.current) draw(1 / 60, 0)
  }, [shape, size, colors, draw])

  function randomize() {
    const random = makeRandom(Math.floor(Date.now() % 2147483647))
    const nextSize = 0.85 + random() * 0.5
    const nextShape = SHAPES[Math.floor(random() * SHAPES.length)]?.key ?? 'liquid'
    setShape(nextShape)
    setSize(nextSize)
    setPaletteIndex(Math.floor(random() * PALETTES.length))
    setSeed(Math.floor(random() * 100000) + 1)
    setNotice('已随机生成新形态')
  }

  async function copyRecipe() {
    const text = encodeRecipe(recipe)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setNotice(`配方已复制：${text}`)
    } catch {
      setNotice(`复制不可用，可手动记录：${text}`)
    }
  }

  const stageHandlers = interactive
    ? {
        onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
          const rect = event.currentTarget.getBoundingClientRect()
          pointerRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            active: true,
            dragging: pointerRef.current.dragging,
          }
          // 减少动效模式下不跑动画循环，但仍让拖动“静态跟随”，保证交互不失效
          if (reducedRef.current) draw(1 / 60, 0)
        },
        onPointerLeave: () => {
          pointerRef.current = { x: 0, y: 0, active: false, dragging: false }
          if (reducedRef.current) draw(1 / 60, 0)
        },
        onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
          const rect = event.currentTarget.getBoundingClientRect()
          pointerRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            active: true,
            dragging: true,
          }
          // 指针可能已被释放（合成事件/系统取消），捕获失败不应影响后续逻辑
          try {
            event.currentTarget.setPointerCapture?.(event.pointerId)
          } catch {
            /* 忽略：未能捕获指针时仍可继续拖拽（未捕获模式） */
          }
          if (reducedRef.current) draw(1 / 60, 0)
        },
        onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
          pointerRef.current.dragging = false
          try {
            event.currentTarget.releasePointerCapture?.(event.pointerId)
          } catch {
            /* 忽略 */
          }
          if (reducedRef.current) draw(1 / 60, 0)
        },
        onPointerCancel: () => {
          pointerRef.current = { x: 0, y: 0, active: false, dragging: false }
          if (reducedRef.current) draw(1 / 60, 0)
        },
      }
    : {}

  const svg = (
    <svg className={styles.svg} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`blob-grad-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <path ref={pathRef} className={styles.path} fill={`url(#blob-grad-${variant})`} d="" />
    </svg>
  )

  if (variant === 'backdrop') {
    return (
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.stage} ref={stageRef}>
          {svg}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.stage} ref={stageRef} role="img" aria-label={ariaLabel} {...stageHandlers}>
        {svg}
        <span className={styles.hint}>按住拖动可塑形</span>
      </div>
      <div className={styles.controls} role="group" aria-label="Blob 形态设置">
        {SHAPES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`${styles.chip} ${shape === item.key ? styles.chipActive : ''}`}
            aria-pressed={shape === item.key}
            onClick={() => setShape(item.key)}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className={styles.chip}
          onClick={() => setPaletteIndex((index) => (index + 1) % PALETTES.length)}
        >
          换色
        </button>
        <button type="button" className={styles.chip} onClick={randomize}>
          随机
        </button>
        <button type="button" className={styles.chip} onClick={copyRecipe}>
          复制配方
        </button>
      </div>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
    </div>
  )
}
