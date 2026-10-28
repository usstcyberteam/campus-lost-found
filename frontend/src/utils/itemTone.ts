import type { TagTone } from '../components/ui/Tag'
import type { ItemStatus } from '../types'

/** 帖子状态 → 标签色调：列表卡片与详情页共用，保证同一状态处处同色。 */
export const STATUS_TONES: Record<ItemStatus, TagTone> = {
  searching: 'warning',
  pending: 'warning',
  reviewing: 'primary',
  found: 'success',
  returned: 'success',
  withdrawn: 'neutral',
  deleted: 'neutral',
}

export type StampTone = 'red' | 'blue' | 'amber' | 'gray'

/** 帖子状态 → 印章颜色：结案盖红章，进行中盖蓝章，核验中盖黄章，撤回 / 删除盖灰章。 */
export const STAMP_TONES: Record<ItemStatus, StampTone> = {
  searching: 'blue',
  pending: 'blue',
  reviewing: 'amber',
  found: 'red',
  returned: 'red',
  withdrawn: 'gray',
  deleted: 'gray',
}

/** 案件编号：XW-发布月日-编号前三位。只用于展示，不对应后端字段。 */
export function caseNumber(item: { id: string; created_at: string }): string {
  const date = new Date(item.created_at)
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `XW-${mmdd}-${item.id.replace(/-/g, '').slice(0, 3).toUpperCase()}`
}

// 物品类别 → 证物插画（public/brand/items）。按关键词匹配，"钱包"要排在"包"前面
const CATEGORY_ART: [string, string][] = [
  ['钱包', 'wallet'],
  ['卡', 'card'],
  ['伞', 'umbrella'],
  ['杯', 'bottle'],
  ['水壶', 'bottle'],
  ['手机', 'phone'],
  ['充电', 'phone'],
  ['电脑', 'laptop'],
  ['笔记本', 'laptop'],
  ['耳机', 'headphones'],
  ['钥匙', 'keys'],
  ['包', 'backpack'],
]

/** 没有照片的帖子用这张类别插画当证物缩略图。 */
export function categoryArt(category: string | null | undefined): string {
  const text = category ?? ''
  const match = CATEGORY_ART.find(([keyword]) => text.includes(keyword))
  return `/brand/items/${match ? match[1] : 'unknown'}.webp`
}

const TITLE_STAMPS = ['见习寻物人', '热心同学', '寻物能手', '校园守护者', '寻物传说']

/** 积分称号 → 对应等级的印章图（public/brand/stamps）；未知称号用第一枚。 */
export function titleStamp(title: string): string {
  return `/brand/stamps/title-${Math.max(TITLE_STAMPS.indexOf(title), 0) + 1}.webp`
}
