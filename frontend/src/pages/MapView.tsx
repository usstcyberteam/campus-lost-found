import { useEffect, useMemo, useState } from 'react'
import { listSimulatedPoints } from '../api/layers'
import { useAsync } from '../hooks/useAsync'
import { useLayers } from '../hooks/useLayers'
import { useAuth } from '../auth/AuthContext'
import type { SimulatedPoint } from '../types'
import ErrorNotice from '../components/ErrorNotice'
import PageContainer from '../components/PageContainer'
import CampusMap, { type MapMarker } from '../components/CampusMap/CampusMap'
import ClickCoordsPopup from './ClickCoordsPopup'
import styles from './MapView.module.css'

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export default function MapView() {
  const { role } = useAuth()
  const [selected, setSelected] = useState('')
  const [calibrated, setCalibrated] = useState(false)
  const [imageError, setImageError] = useState('')

  const { data: layers, error: layersError } = useLayers()
  const { data: points, error: pointsError } = useAsync(
    () =>
      selected && (role === 'staff' || role === 'admin')
        ? listSimulatedPoints(selected)
        : Promise.resolve<SimulatedPoint[]>([]),
    [selected, role],
  )

  useEffect(() => {
    if (layers && layers.length > 0) setSelected(layers[0].id)
  }, [layers])

  const layer = layers?.find((l) => l.id === selected)

  useEffect(() => {
    const current = layers?.find((l) => l.id === selected)
    setCalibrated(current?.scale_calibrated ?? false)
  }, [selected, layers])

  const markers = useMemo<MapMarker[]>(
    () =>
      (points ?? []).map((p) => ({
        x: p.norm_x,
        y: p.norm_y,
        label: `${p.label}（模拟点位）`,
        color: cssVar('--color-warning'),
      })),
    [points],
  )

  return (
    <PageContainer>
      <h1>地图</h1>
      {layersError && <ErrorNotice message={layersError} />}
      {pointsError && <ErrorNotice message={pointsError} />}
      {imageError && <ErrorNotice message={imageError} />}
      {(!layers || layers.length === 0) && !layersError && <p>暂无图层，请先初始化地图数据。</p>}
      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        {layers?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.scale_calibrated ? '（已标定）' : '（未标定，不显示米数）'}
          </option>
        ))}
      </select>
      {layer && (
        <CampusMap layer={layer} markers={markers} onImageError={setImageError}>
          <ClickCoordsPopup />
        </CampusMap>
      )}
      <p className={styles.hint}>
        点击地图获取归一化坐标；{calibrated ? '已标定比例尺' : '未标定比例尺，不换算实际米数'}。
      </p>
    </PageContainer>
  )
}
