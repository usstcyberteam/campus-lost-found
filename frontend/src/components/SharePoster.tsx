import { useEffect, useRef, useState } from 'react'
import { getBuilding } from '../api/buildings'
import { placeLabel, type Building, type Item, type Layer } from '../types'
import { buildingPoint } from './CampusMap/mapResults'
import { loadFlatMap, toPixel } from './LocationMiniMap/flatMap'
import styles from './SharePoster.module.css'

// 逻辑画布 375×600（任务规格）；实际导出 2x（750×1200）保证清晰
const POSTER_W = 375
const POSTER_H = 600
const EXPORT_SCALE = 2
const MAP_H = 150
const MAP_GAP = 18
// 原 600 高的卡片在地点行与底栏之间本有余量；按最长内容（标题 2 行 + 描述 3 行）算，加地图只需再长 60
const MAP_EXTRA_H = 60
// 地图视窗宽度占整张平面图的比例，与详情页小地图一致
const MAP_VIEW_RATIO = 0.3

const SITE_NAME = '校园失物招领'
const DIRECTION_LABELS: Record<string, string> = { lost: '寻物启事', found: '失物招领' }

interface Theme {
  primary: string
  text1: string
  text2: string
  bg1: string
  bg2: string
  border: string
  borderStrong: string
  inverse: string
  accentGlow: string
  paper: string
}

/** 卡片上的地图块数据：只标到楼，不画发帖人才能看到的精确点（卡片会被转发到公开场合） */
interface PosterMap {
  image: HTMLImageElement
  layer: Layer
  building: Building
  point: { x: number; y: number }
}

async function loadPosterMap(item: Item): Promise<PosterMap | null> {
  if (!item.building_id) return null
  const [flat, building] = await Promise.all([loadFlatMap(), getBuilding(item.building_id)])
  const point = buildingPoint(building)
  if (!point) return null
  const image = new Image()
  image.src = flat.url
  await image.decode()
  return { image, layer: flat.layer, building, point }
}

function readTheme(): Theme {
  const root = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string): string => root.getPropertyValue(name).trim() || fallback
  return {
    primary: read('--color-primary', '#2563eb'),
    text1: read('--color-text-1', '#1f2937'),
    text2: read('--color-text-2', '#6b7280'),
    bg1: read('--color-bg-1', '#ffffff'),
    bg2: read('--color-bg-2', '#f5f7fa'),
    border: read('--color-border', '#e5e7eb'),
    borderStrong: read('--color-border-strong', '#cbd5e1'),
    inverse: read('--color-text-inverse', '#ffffff'),
    accentGlow: read('--color-accent-glow', 'rgba(242, 201, 76, 0.5)'),
    paper: read('--color-paper', '#ffffff'),
  }
}

/** 逐字累加换行并截断：最多 maxLines 行，末行超出加省略号。 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = []
  let current = ''
  for (const char of text.replace(/\s+/g, ' ').trim()) {
    if (ctx.measureText(current + char).width > maxWidth && current) {
      lines.push(current)
      current = char
      if (lines.length === maxLines) break
    } else {
      current += char
    }
  }
  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length === maxLines && (current || text.replace(/\s+/g, ' ').trim().length > lines.join('').length)) {
    const last = lines[maxLines - 1]
    if (last) lines[maxLines - 1] = `${last.slice(0, -1)}…`
  }
  return lines
}

/** 伪二维码：基于 URL 的确定性哈希画 21×21 网格 + 三角定位块（装饰性，真实入口靠链接文字）。 */
function drawQrLike(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number, dark: string) {
  let hash = 2166136261
  for (let i = 0; i < url.length; i += 1) {
    hash ^= url.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const cells = 21
  const cell = size / cells
  ctx.fillStyle = dark
  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      const inFinder =
        (row < 7 && col < 7) || (row < 7 && col >= cells - 7) || (row >= cells - 7 && col < 7)
      if (inFinder) continue
      hash = Math.imul(hash ^ (row * 31 + col), 2654435761)
      if ((hash >>> 16) % 2 === 0) {
        ctx.fillRect(x + col * cell, y + row * cell, cell + 0.5, cell + 0.5)
      }
    }
  }
  const finder = (fx: number, fy: number) => {
    ctx.fillRect(fx, fy, cell * 7, cell * 7)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(fx + cell, fy + cell, cell * 5, cell * 5)
    ctx.fillStyle = dark
    ctx.fillRect(fx + cell * 2, fy + cell * 2, cell * 3, cell * 3)
  }
  finder(x, y)
  finder(x + cell * (cells - 7), y)
  finder(x, y + cell * (cells - 7))
}

/** 地图块：截取平面图上目标楼附近一块，虚线框出楼体，中心一枚定位环，左下角标楼名。 */
function drawMapBlock(
  ctx: CanvasRenderingContext2D,
  map: PosterMap,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: Theme,
) {
  const { layer, image } = map
  const center = toPixel(layer, map.point)
  const sw = layer.width * MAP_VIEW_RATIO
  const sh = sw * (h / w)
  // 靠近图边的楼：视窗贴边截取，图钉随之偏离中心
  const sx = Math.min(Math.max(center.x - sw / 2, 0), layer.width - sw)
  const sy = Math.min(Math.max(center.y - sh / 2, 0), layer.height - sh)
  const scale = w / sw
  const toDest = (p: { x: number; y: number }) => ({ x: x + (p.x - sx) * scale, y: y + (p.y - sy) * scale })

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 6)
  ctx.clip()
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h)

  const region = map.building.click_region
  if (region && region.length > 2) {
    ctx.beginPath()
    region.forEach((p, index) => {
      const d = toDest(toPixel(layer, { x: Number(p.x), y: Number(p.y) }))
      if (index === 0) ctx.moveTo(d.x, d.y)
      else ctx.lineTo(d.x, d.y)
    })
    ctx.closePath()
    ctx.fillStyle = theme.accentGlow
    ctx.fill()
    ctx.setLineDash([5, 3])
    ctx.strokeStyle = theme.primary
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.setLineDash([])
  }

  const pin = toDest(center)
  ctx.beginPath()
  ctx.arc(pin.x, pin.y, 16, 0, Math.PI * 2)
  ctx.globalAlpha = 0.35
  ctx.strokeStyle = theme.primary
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(pin.x, pin.y, 8, 0, Math.PI * 2)
  ctx.fillStyle = theme.paper
  ctx.fill()
  ctx.lineWidth = 3.5
  ctx.stroke()
  ctx.restore()

  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 6)
  ctx.strokeStyle = theme.borderStrong
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.font = '600 12px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  const label = map.building.name
  const labelW = ctx.measureText(label).width + 16
  ctx.fillStyle = theme.paper
  ctx.fillRect(x + 8, y + h - 30, labelW, 22)
  ctx.strokeStyle = theme.borderStrong
  ctx.lineWidth = 1
  ctx.strokeRect(x + 8, y + h - 30, labelW, 22)
  ctx.fillStyle = theme.text1
  ctx.fillText(label, x + 16, y + h - 19)
}

function drawPoster(canvas: HTMLCanvasElement, item: Item, url: string, map: PosterMap | null): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 不可用')
  const theme = readTheme()
  const posterH = POSTER_H + (map ? MAP_EXTRA_H : 0)
  canvas.width = POSTER_W * EXPORT_SCALE
  canvas.height = posterH * EXPORT_SCALE
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE)

  ctx.fillStyle = theme.bg1
  ctx.fillRect(0, 0, POSTER_W, posterH)

  // 顶部：主色横幅 + 圆形 Logo + 站名
  ctx.fillStyle = theme.primary
  ctx.fillRect(0, 0, POSTER_W, 92)
  ctx.beginPath()
  ctx.arc(36, 46, 20, 0, Math.PI * 2)
  ctx.fillStyle = theme.bg1
  ctx.fill()
  ctx.fillStyle = theme.primary
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('寻', 36, 47)
  ctx.fillStyle = theme.inverse
  ctx.font = '600 20px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(SITE_NAME, 66, 46)

  // 中部：方向徽标 + 标题（最多 2 行）
  const badge = DIRECTION_LABELS[item.direction] ?? '校园寻物'
  const contentX = 20
  const contentW = POSTER_W - contentX * 2
  let y = 122
  ctx.fillStyle = theme.primary
  ctx.font = '500 12px system-ui, sans-serif'
  const badgeW = ctx.measureText(badge).width + 16
  ctx.fillRect(contentX, y - 12, badgeW, 22)
  ctx.fillStyle = theme.inverse
  ctx.fillText(badge, contentX + 8, y)

  y += 34
  ctx.fillStyle = theme.text1
  ctx.font = '700 20px system-ui, sans-serif'
  for (const line of wrapText(ctx, item.title, contentW, 2)) {
    ctx.fillText(line, contentX, y)
    y += 28
  }

  // 描述：最多 3 行
  if (item.description) {
    y += 8
    ctx.fillStyle = theme.text2
    ctx.font = '400 14px system-ui, sans-serif'
    for (const line of wrapText(ctx, item.description, contentW, 3)) {
      ctx.fillText(line, contentX, y)
      y += 22
    }
  }

  // 地图块：有建筑时才画
  if (map) {
    y += MAP_GAP
    drawMapBlock(ctx, map, contentX, y, contentW, MAP_H, theme)
    ctx.textBaseline = 'middle'
    y += MAP_H
  }

  // 地点 + 时间
  y += 14
  ctx.strokeStyle = theme.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(contentX, y)
  ctx.lineTo(POSTER_W - contentX, y)
  ctx.stroke()
  y += 26
  ctx.fillStyle = theme.text1
  ctx.font = '500 14px system-ui, sans-serif'
  const place = item.building_name ? placeLabel(item) : item.location_area || '地点未知'
  ctx.fillText(`📍 ${place}`, contentX, y)
  y += 24
  const timeValue = item.time_occurred ?? item.created_at
  const timeText = timeValue ? new Date(timeValue).toLocaleString('zh-CN', { dateStyle: 'medium' }) : '时间未知'
  ctx.fillStyle = theme.text2
  ctx.fillText(`🕐 ${timeText}`, contentX, y)

  // 底部：浅色块 + 链接 + "扫码查看详情" + 伪二维码
  const footerY = posterH - 116
  ctx.fillStyle = theme.bg2
  ctx.fillRect(0, footerY, POSTER_W, posterH - footerY)
  const qrSize = 84
  const qrX = POSTER_W - qrSize - 20
  const qrY = footerY + (posterH - footerY - qrSize) / 2
  drawQrLike(ctx, url, qrX, qrY, qrSize, theme.text1)
  ctx.fillStyle = theme.text1
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.fillText('扫码查看详情', contentX, qrY + 28)
  ctx.fillStyle = theme.primary
  ctx.font = '400 12px system-ui, sans-serif'
  ctx.fillText(url, contentX, qrY + 52, qrX - contentX - 12)
}

interface SharePosterProps {
  open: boolean
  item: Item
  onClose: () => void
}

/** 寻物海报分享卡片：纯 canvas 手绘（无 html2canvas 依赖），保存/复制/分享 + 打印兜底。 */
export default function SharePoster({ open, item, onClose }: SharePosterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'drawing' | 'ready' | 'failed'>('drawing')
  const [message, setMessage] = useState('')
  const posterUrl = `${window.location.origin}/hall/${item.id}`

  useEffect(() => {
    if (!open) return
    setStatus('drawing')
    setMessage('')
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !canvasRef.current) return
    const canvas = canvasRef.current
    let active = true
    // 地图加载失败不影响出图：退回不带地图的卡片
    loadPosterMap(item)
      .catch(() => null)
      .then((map) => {
        if (!active) return
        try {
          drawPoster(canvas, item, posterUrl, map)
          setStatus('ready')
        } catch {
          setStatus('failed')
        }
      })
    return () => {
      active = false
    }
  }, [open, item, posterUrl])

  function currentBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current
    if (!canvas) return Promise.resolve(null)
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  }

  async function onSave() {
    try {
      const blob = await currentBlob()
      if (!blob) throw new Error('toBlob failed')
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `寻物海报-${item.title.slice(0, 12)}.png`
      link.click()
      URL.revokeObjectURL(link.href)
      setMessage('已保存图片')
    } catch {
      onPrint()
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(posterUrl)
      setMessage('链接已复制')
    } catch {
      setMessage('复制失败，请长按链接复制')
    }
  }

  async function onShare() {
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
    try {
      if (nav.share) {
        if (nav.canShare?.({ files: [] })) {
          const blob = await currentBlob()
          if (blob) {
            const file = new File([blob], 'poster.png', { type: 'image/png' })
            if (nav.canShare({ files: [file] })) {
              await nav.share({ files: [file], title: item.title, text: SITE_NAME })
              return
            }
          }
        }
        await nav.share({ title: item.title, text: SITE_NAME, url: posterUrl })
        return
      }
      setMessage('当前浏览器不支持系统分享，请保存图片')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setMessage('分享失败，请保存图片后手动发送')
    }
  }

  /** toBlob/canvas 不可用时的兜底：打印输出（任务指定的降级路线）。 */
  function onPrint() {
    const canvas = canvasRef.current
    if (!canvas) return
    const win = window.open('', '_blank')
    if (!win) {
      setMessage('弹窗被拦截，请允许弹窗后重试')
      return
    }
    win.document.write(
      `<title>寻物海报</title><body style="margin:0;display:flex;justify-content:center;">` +
        `<img src="${canvas.toDataURL('image/png')}" style="width:${POSTER_W}px" /></body>`,
    )
    win.document.close()
    win.focus()
    win.print()
  }

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="生成分享卡片"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>📤 分享卡片</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="关闭分享卡片">
            ×
          </button>
        </header>
        <div className={styles.preview}>
          {status === 'drawing' && <p className={styles.state}>正在生成卡片…</p>}
          {status === 'failed' && (
            <div className={styles.state}>
              <p>卡片生成失败，可使用打印方式输出。</p>
              <button type="button" className={styles.actionButton} onClick={onPrint}>
                🖨 打印海报
              </button>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className={status === 'ready' ? styles.canvas : styles.canvasHidden}
            aria-label={`寻物海报预览：${item.title}`}
          />
        </div>
        {status === 'ready' && (
          <div className={styles.actions} role="group" aria-label="分享操作">
            <button type="button" className={styles.actionButton} onClick={onSave}>
              💾 保存图片
            </button>
            <button type="button" className={styles.actionButton} onClick={onCopy}>
              🔗 复制链接
            </button>
            <button type="button" className={styles.actionButton} onClick={onShare}>
              📤 分享
            </button>
            <button type="button" className={`${styles.actionButton} ${styles.actionMinor}`} onClick={onPrint}>
              🖨 打印
            </button>
          </div>
        )}
        {message && (
          <p className={styles.message} role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  )
}