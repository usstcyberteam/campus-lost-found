import type { DrawToolState } from '../../hooks/useDrawTool'
import type { Layer, Visibility } from '../../types'
import Button from '../Button'
import styles from './MapDrawer.module.css'

interface MapDrawerToolsProps {
  layer: Layer | null
  canDraw: boolean
  outdoor: boolean
  tool: DrawToolState
  advicePending: boolean
  onRecommend: () => void
  onPublish: () => void
}

// 绘制工具面板：标点、圈范围、画路径与发布
export default function MapDrawerTools({
  layer,
  canDraw,
  outdoor,
  tool,
  advicePending,
  onRecommend,
  onPublish,
}: MapDrawerToolsProps) {
  if (!layer || !canDraw) {
    return (
      <div className={styles.panel}>
        <p className={styles.empty}>地图加载后可在此标点、圈范围、画路径。</p>
      </div>
    )
  }

  const drawing = tool.mode !== null
  const canUndo = tool.point !== null || tool.circle !== null || tool.points.length > 0

  return (
    <div className={styles.panel}>
      <div className={styles.drawBar} role="toolbar" aria-label="地图绘制工具">
        <Button
          type="button"
          variant={tool.mode === 'point' ? 'primary' : 'secondary'}
          aria-pressed={tool.mode === 'point'}
          onClick={() => tool.start('point')}
        >
          标点
        </Button>
        <Button
          type="button"
          variant={tool.mode === 'circle' ? 'primary' : 'secondary'}
          aria-pressed={tool.mode === 'circle'}
          onClick={() => tool.start('circle')}
        >
          圈范围
        </Button>
        <Button
          type="button"
          variant={tool.mode === 'polyline' ? 'primary' : 'secondary'}
          aria-pressed={tool.mode === 'polyline'}
          onClick={() => tool.start('polyline')}
        >
          画路径
        </Button>
        <Button type="button" variant="secondary" onClick={tool.undo} disabled={!canUndo}>
          撤销上一步
        </Button>
        <Button type="button" variant="secondary" onClick={tool.finish} disabled={!drawing}>
          完成
        </Button>
        <Button type="button" variant="ghost" onClick={tool.clear} disabled={!canUndo && !drawing}>
          清空
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onRecommend}
          disabled={!outdoor || !tool.hasResult}
          loading={advicePending}
        >
          AI 推荐地点
        </Button>
      </div>
      {tool.hasResult && tool.routeKind && (
        <div className={styles.visibility}>
          <label className={styles.visibilityLabel}>
            路线可见性
            <select
              value={tool.visibility}
              onChange={(event) => tool.setVisibility(event.target.value as Visibility)}
            >
              <option value="private">私密（仅自己与已授权处理人员）</option>
              <option value="public">公开</option>
            </select>
          </label>
          <span className={styles.note}>圈选默认公开，路径默认私密</span>
        </div>
      )}
      {tool.hasResult && (
        <Button type="button" onClick={onPublish}>
          发布到大厅
        </Button>
      )}
      <p className={styles.note}>
        点击地图获取归一化坐标；建筑层与帖子点位仅在室外底图可用；监控点为模拟数据，仅工作人员可见；
        {layer.scale_calibrated ? '已标定比例尺' : '未标定比例尺，不换算实际米数'}。
      </p>
    </div>
  )
}