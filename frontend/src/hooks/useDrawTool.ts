import { useState } from 'react'
import type { CircleGeometry, PolylineGeometry } from '../api/items'
import type { RouteKind, Visibility } from '../types'

export type DrawMode = 'point' | 'circle' | 'polyline'

export interface NormPoint {
  x: number
  y: number
}

export interface DrawCircle {
  center: NormPoint
  radius: number
}

export interface DrawToolState {
  mode: DrawMode | null
  point: NormPoint | null
  circle: DrawCircle | null
  points: NormPoint[]
  visibility: Visibility
  hasResult: boolean
  routeKind: RouteKind | null
  setVisibility: (value: Visibility) => void
  start: (mode: DrawMode) => void
  clear: () => void
  undo: () => void
  finish: () => void
  handleClick: (norm: NormPoint) => void
  updateCircle: (norm: NormPoint) => void
  geometry: () => CircleGeometry | PolylineGeometry | null
}

const MIN_RADIUS = 0.005

export function useDrawTool(): DrawToolState {
  const [mode, setMode] = useState<DrawMode | null>(null)
  const [point, setPoint] = useState<NormPoint | null>(null)
  const [circle, setCircle] = useState<DrawCircle | null>(null)
  const [points, setPoints] = useState<NormPoint[]>([])
  const [visibility, setVisibility] = useState<Visibility>('private')

  function start(next: DrawMode) {
    setMode(next)
    setVisibility(next === 'circle' ? 'public' : 'private')
    setPoint(null)
    setCircle(null)
    setPoints([])
  }

  function clear() {
    setMode(null)
    setPoint(null)
    setCircle(null)
    setPoints([])
  }

  function undo() {
    if (mode === 'polyline') {
      setPoints((current) => current.slice(0, -1))
      return
    }
    if (mode === 'circle') {
      setCircle(null)
      return
    }
    setPoint(null)
  }

  function finish() {
    setMode(null)
  }

  function handleClick(norm: NormPoint) {
    if (mode === 'point') {
      setPoint(norm)
      setMode(null)
      return
    }
    if (mode === 'circle') {
      if (circle === null) {
        setCircle({ center: norm, radius: MIN_RADIUS })
        return
      }
      updateCircle(norm)
      setMode(null)
      return
    }
    if (mode === 'polyline') {
      setPoints((current) => [...current, norm])
    }
  }

  function updateCircle(norm: NormPoint) {
    setCircle((current) => {
      if (current === null) return current
      const radius = Math.hypot(norm.x - current.center.x, norm.y - current.center.y)
      return { center: current.center, radius: Math.max(MIN_RADIUS, Math.min(1, radius)) }
    })
  }

  function geometry(): CircleGeometry | PolylineGeometry | null {
    if (circle !== null) return { center: circle.center, radius: circle.radius }
    if (points.length >= 2) return { points }
    return null
  }

  const hasResult = point !== null || circle !== null || points.length >= 2
  const routeKind: RouteKind | null = circle !== null ? 'circle' : points.length >= 2 ? 'polyline' : null

  return {
    mode,
    point,
    circle,
    points,
    visibility,
    hasResult,
    routeKind,
    setVisibility,
    start,
    clear,
    undo,
    finish,
    handleClick,
    updateCircle,
    geometry,
  }
}