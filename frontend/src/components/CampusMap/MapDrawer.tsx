import { useRef, useState, type PointerEvent } from 'react'
import type { DrawToolState } from '../../hooks/useDrawTool'
import type { Building, Layer } from '../../types'
import type { MapLayerSwitches } from './MapCanvas'
import type { MapViewMode } from './MapTopBar'
import MapDrawerLayers from './MapDrawerLayers'
import MapDrawerResults from './MapDrawerResults'
import MapDrawerTools from './MapDrawerTools'
import styles from './MapDrawer.module.css'

export type MapDrawerTab = 'results' | 'layers' | 'tools'

const TABS: { key: MapDrawerTab; label: string }[] = [
  { key: 'results', label: '结果' },
  { key: 'layers', label: '图层' },
  { key: 'tools', label: '工具' },
]

type DrawerState = 'collapsed' | 'half' | 'expanded'
type DrawerAnchors = { collapsed: number; half: number; expanded: number }

function drawerAnchors(): DrawerAnchors {
  const desktop = window.matchMedia('(min-width: 768px)').matches
  const collapsed = desktop ? 220 : 190
  const expanded = Math.round(window.innerHeight * (desktop ? 0.72 : 0.68))
  const half = Math.round(window.innerHeight * (desktop ? 0.45 : 0.4))
  return { collapsed, half, expanded }
}

function nearestDrawerState(height: number, anchors: DrawerAnchors): DrawerState {
  const dCollapsed = Math.abs(height - anchors.collapsed)
  const dHalf = Math.abs(height - anchors.half)
  const dExpanded = Math.abs(height - anchors.expanded)
  if (dHalf <= dCollapsed && dHalf <= dExpanded) return 'half'
  return dExpanded < dCollapsed ? 'expanded' : 'collapsed'
}

interface MapDrawerProps {
  view: MapViewMode
  tab: MapDrawerTab
  onTabChange: (tab: MapDrawerTab) => void
  results: Building[]
  nearUnavailable: boolean
  selectedId: string | null
  onSelectBuilding: (building: Building) => void
  layersError: string
  mapLayersError: string
  pointsError: string
  layerSwitches: MapLayerSwitches
  onToggleLayer: (key: keyof MapLayerSwitches, checked: boolean) => void
  canSeeMonitor: boolean
  adviceReady: boolean
  layer: Layer | null
  canDraw: boolean
  tool: DrawToolState
  advicePending: boolean
  onRecommend: () => void
  onPublish: () => void
}

// 底部可拖拽抽屉：结果、图层开关、绘制工具；室内视图不提供绘制
export default function MapDrawer({
  view,
  tab,
  onTabChange,
  results,
  nearUnavailable,
  selectedId,
  onSelectBuilding,
  layersError,
  mapLayersError,
  pointsError,
  layerSwitches,
  onToggleLayer,
  canSeeMonitor,
  adviceReady,
  layer,
  canDraw,
  tool,
  advicePending,
  onRecommend,
  onPublish,
}: MapDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<{ startY: number; startHeight: number; height: number; anchors: DrawerAnchors } | null>(null)
  const dragMovedRef = useRef(false)
  const [drawerState, setDrawerState] = useState<DrawerState>('collapsed')
  const [dragHeight, setDragHeight] = useState<number | null>(null)

  const outdoor = view === 'flat'
  const showTools = view !== 'iso'
  const activeTab: MapDrawerTab = !showTools && tab === 'tools' ? 'results' : tab

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragHeight(null)
    if (drag && dragMovedRef.current) {
      setDrawerState(nearestDrawerState(drag.height, drag.anchors))
    }
  }

  return (
    <section
      ref={drawerRef}
      className={`${styles.drawer} ${drawerState === 'expanded' ? styles.drawerExpanded : ''} ${drawerState === 'half' ? styles.drawerHalf : ''} ${dragHeight != null ? styles.drawerDragging : ''}`}
      style={dragHeight != null ? { height: dragHeight } : undefined}
      aria-label="地图结果与设置"
    >
      <div
        className={styles.handle}
        role="button"
        tabIndex={0}
        aria-label={drawerState === 'collapsed' ? '展开面板' : '收起面板'}
        aria-expanded={drawerState !== 'collapsed'}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return
          const rect = drawerRef.current?.getBoundingClientRect()
          if (!rect) return
          const anchors = drawerAnchors()
          dragRef.current = { startY: event.clientY, startHeight: rect.height, height: rect.height, anchors }
          dragMovedRef.current = false
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          if (!drag) return
          const dy = drag.startY - event.clientY
          if (!dragMovedRef.current && Math.abs(dy) < 4) return
          dragMovedRef.current = true
          const next = Math.max(drag.anchors.collapsed, Math.min(drag.startHeight + dy, drag.anchors.expanded))
          drag.height = next
          setDragHeight(next)
        }}
        onPointerUp={(event) => finishDrag(event)}
        onPointerCancel={(event) => finishDrag(event)}
        onClick={() => {
          if (dragMovedRef.current) {
            dragMovedRef.current = false
            return
          }
          setDrawerState((value) => (value === 'collapsed' ? 'expanded' : 'collapsed'))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            setDrawerState((value) => (value === 'collapsed' ? 'expanded' : 'collapsed'))
          }
        }}
      >
        <span className={styles.handleBar} aria-hidden="true" />
      </div>

      <div className={styles.tabs} role="tablist" aria-label="地图面板">
        {TABS.filter((item) => showTools || item.key !== 'tools').map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={activeTab === item.key}
            className={`${styles.tab} ${activeTab === item.key ? styles.tabActive : ''}`}
            onClick={() => {
              onTabChange(item.key)
              setDrawerState('expanded')
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.drawerBody}>
        {activeTab === 'results' && (
          <MapDrawerResults
            results={results}
            nearUnavailable={nearUnavailable}
            selectedId={selectedId}
            onSelectBuilding={onSelectBuilding}
          />
        )}
        {activeTab === 'layers' && (
          <MapDrawerLayers
            view={view}
            switches={layerSwitches}
            onToggle={onToggleLayer}
            canSeeMonitor={canSeeMonitor}
            adviceReady={adviceReady}
            layersError={layersError}
            mapLayersError={mapLayersError}
            pointsError={pointsError}
          />
        )}
        {activeTab === 'tools' && (
          <MapDrawerTools
            layer={layer}
            canDraw={canDraw}
            outdoor={outdoor}
            tool={tool}
            advicePending={advicePending}
            onRecommend={onRecommend}
            onPublish={onPublish}
          />
        )}
      </div>
    </section>
  )
}