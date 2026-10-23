import type { Building, FlatToIsoMatrix } from '../../types'
import IsoBuildingLayer from './IsoBuildingLayer'

interface IndoorLayersProps {
  buildings: Building[]
  matrix: FlatToIsoMatrix | null
  selectedId: string | null
  recommendedCodes: string[]
  showBuildings: boolean
  showAdvice: boolean
  showLabels: boolean
}

// 室内 2.5D 视图只承载选楼层：不绘制帖子、求助点、监控点、热力与路线
export default function IndoorLayers({
  buildings,
  matrix,
  selectedId,
  recommendedCodes,
  showBuildings,
  showAdvice,
  showLabels,
}: IndoorLayersProps) {
  if (!showBuildings) return null

  return (
    <IsoBuildingLayer
      buildings={buildings}
      matrix={matrix}
      selectedId={selectedId}
      recommendedCodes={showAdvice ? recommendedCodes : []}
      showLabels={showLabels}
    />
  )
}