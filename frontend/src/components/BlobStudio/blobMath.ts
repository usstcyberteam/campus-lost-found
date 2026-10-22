export interface BlobPoint {
  x: number
  y: number
}

export type BlobShape = 'soft' | 'liquid' | 'star'

export interface BlobRecipe {
  shape: BlobShape
  palette: number
  size: number
  seed: number
}

export const BLOB_SHAPES: BlobShape[] = ['soft', 'liquid', 'star']

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString()
}

/** Catmull-Rom 转三次贝塞尔，生成闭合平滑路径；点少于 3 个时返回空串（避免非法 path） */
export function smoothClosedPath(points: BlobPoint[]): string {
  const n = points.length
  if (n < 3) return ''
  const at = (index: number) => points[(index + n) % n]
  let d = `M ${round(points[0].x)} ${round(points[0].y)}`
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`
  }
  return `${d} Z`
}

/** 阻尼弹簧步进：非法输入（NaN/Infinity/非正 dt）时保持原值，保证渲染循环不会发散 */
export function springStep(
  current: number,
  target: number,
  velocity: number,
  stiffness: number,
  damping: number,
  dt: number,
): { value: number; velocity: number } {
  if (!Number.isFinite(current) || !Number.isFinite(target) || !Number.isFinite(velocity)) {
    return { value: Number.isFinite(current) ? current : 0, velocity: 0 }
  }
  if (!Number.isFinite(dt) || dt <= 0) return { value: current, velocity }
  const force = (target - current) * stiffness
  const nextVelocity = (velocity + force * dt) * Math.max(0, 1 - damping * dt)
  const nextValue = current + nextVelocity * dt
  if (!Number.isFinite(nextValue) || !Number.isFinite(nextVelocity)) return { value: current, velocity: 0 }
  return { value: nextValue, velocity: nextVelocity }
}

/** 按相位与时间计算各控制点目标半径；wobble 为 0 时退化为等半径正圆 */
export function computeTargetRadii(
  base: number,
  wobble: number,
  phases: number[],
  time: number,
  frequency = 2,
): number[] {
  const safeBase = Number.isFinite(base) && base > 0 ? base : 0
  const amplitude = Number.isFinite(wobble) ? wobble : 0
  const t = Number.isFinite(time) ? time : 0
  const count = phases.length || 1
  return phases.map((phase, index) => {
    const p = Number.isFinite(phase) ? phase : 0
    const angle = (index / count) * Math.PI * 2
    return safeBase * (1 + amplitude * Math.sin(angle * frequency + p + t))
  })
}

/** 线性同余伪随机：相同种子产生相同序列，取值 [0, 1) */
export function makeRandom(seed: number): () => number {
  let state = Math.floor(Number.isFinite(seed) ? seed : 1) || 1
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

/** 配方序列化：用于“复制配方”分享当前形态设置 */
export function encodeRecipe(recipe: BlobRecipe): string {
  return `blob1|${recipe.shape}|${recipe.palette}|${recipe.size.toFixed(2)}|${recipe.seed}`
}

/** 配方反序列化：任何不合法输入一律返回 null，避免污染 UI 状态 */
export function decodeRecipe(text: unknown): BlobRecipe | null {
  if (typeof text !== 'string') return null
  const parts = text.trim().split('|')
  if (parts.length !== 5 || parts[0] !== 'blob1') return null
  const shape = parts[1] as BlobShape
  if (!BLOB_SHAPES.includes(shape)) return null
  const palette = Number(parts[2])
  const size = Number(parts[3])
  const seed = Number(parts[4])
  if (!Number.isInteger(palette) || palette < 0 || palette > 99) return null
  if (!Number.isFinite(size) || size < 0.2 || size > 2) return null
  if (!Number.isFinite(seed)) return null
  return { shape, palette, size, seed }
}