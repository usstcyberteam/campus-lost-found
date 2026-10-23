export type Direction = 'lost' | 'found'
export type ItemStatus = 'searching' | 'reviewing' | 'found' | 'withdrawn' | 'pending' | 'returned' | 'deleted'
export type Source = 'manual' | 'rule' | 'cache' | 'model'
export type Role = 'student' | 'staff' | 'admin'
export type StaffStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type RouteKind = 'polyline' | 'circle'
export type Visibility = 'public' | 'private'
export type EvidenceKind = 'text' | 'image'

export interface DraftPost {
  category: string | null
  title: string | null
  description: string | null
  location_area: string | null
  building_code: string | null
  floor: number | null
  time_occurred: string | null
  source: Source
  degraded: boolean
}

export interface SearchAdviceLocation {
  building_code: string
  building_name: string
  reason: string
  order: number
}

export interface SearchAdvice {
  locations: SearchAdviceLocation[]
  source: Source
  degraded: boolean
}

export interface FormPatch {
  category: string | null
  title: string | null
  description: string | null
  location_area: string | null
  building_code: string | null
  floor: number | null
  time_occurred: string | null
}

export interface AiChatResult {
  intent: 'draft' | 'chat'
  reply: string
  form_patch: FormPatch | null
  actions: string[]
  source: Source
  degraded: boolean
}

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface Photo {
  id: string
  url: string
  mime: string
  size: number
}

export interface Item {
  id: string
  direction: Direction
  category: string
  title: string
  description: string
  location_area: string
  time_occurred: string | null
  status: ItemStatus
  is_simulated: boolean
  is_demo: boolean
  source: Source
  created_at: string
  norm_x: number | null
  norm_y: number | null
  layer_id: string | null
  precise_location?: string | null
  is_owner?: boolean
  building_id: string | null
  building_name: string | null
  floor: number | null
  first_photo: Photo | null
  like_count: number
  comment_count: number
  helper_count: number
  favorite_count: number
  is_liked: boolean
  is_favorited: boolean
  is_helper: boolean
  photos?: Photo[]
  photos_hidden?: boolean
  helpers?: HelperUser[]
}

export interface NotificationItem {
  id: string
  kind: string
  title: string
  content: string
  link: string
  related_item_id: string | null
  source: Source
  read: boolean
  created_at: string
}

// 通知类型标签：kind 与后端 notification.kind 对应
export const notificationKindLabels: Record<string, string> = {
  ai_match: '失物匹配',
}

export function placeLabel(item: { building_name: string | null; floor: number | null }): string {
  if (!item.building_name) return '未指定地点'
  return item.floor == null ? item.building_name : `${item.building_name} ${item.floor}F`
}

export interface Building {
  id: string
  code: string
  name: string
  category: string
  floors: number
  click_region: Record<string, number>[] | null
  label_position: Record<string, number> | null
  active_item_count: number
  has_floor_map: boolean
}

export const statusLabels: Record<ItemStatus, string> = {
  searching: '寻找中',
  reviewing: '核验中',
  found: '已找回',
  withdrawn: '已撤销',
  pending: '待认领',
  returned: '已归还',
  deleted: '已删除',
}

export const directionLabels: Record<Direction, string> = {
  lost: '寻物',
  found: '拾获',
}

export const roleLabels: Record<Role, string> = {
  student: '学生',
  staff: '工作人员',
  admin: '管理员',
}

export interface User {
  id: string
  username: string
  display_name: string
  role: Role
  staff_status: StaffStatus
  staff_no: string | null
  department: string | null
  staff_reject_reason: string | null
  contact?: string | null
}

export interface AdminUser {
  id: string
  username: string
  display_name: string
  role: Role
  staff_status: StaffStatus
  is_banned: boolean
  created_at: string
}

export interface StatCount {
  key: string
  name: string
  count: number
}

export interface AdminStats {
  total_items: number
  lost_count: number
  found_count: number
  active_count: number
  returned_count: number
  claim_total: number
  claim_pending: number
  claim_approved: number
  claim_completed: number
  recovery_rate: number
  avg_handling_hours: number | null
  by_building: StatCount[]
  by_category: StatCount[]
  by_status: StatCount[]
}

export const staffStatusLabels: Record<StaffStatus, string> = {
  none: '未申请',
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
}

export interface StaffApplication {
  user_id: string
  username: string
  display_name: string
  staff_no: string | null
  department: string | null
  staff_status: StaffStatus
  created_at: string
}

export interface Layer {
  id: string
  name: string
  version: string
  width: number
  height: number
  scale_calibrated: boolean
  image_path: string | null
  building_id: string | null
  floor: number | null
}

export interface SimulatedPoint {
  id: string
  label: string
  norm_x: number
  norm_y: number
  is_simulated: boolean
  description: string | null
}

export type SimulatedPointKind = 'help_point' | 'monitor_point'

export interface LayerPoint {
  id: string
  kind: SimulatedPointKind
  label: string
  norm_x: number
  norm_y: number
  is_simulated: boolean
  is_public: boolean
  description: string | null
}

export interface LayerPoints {
  points: LayerPoint[]
  has_monitor: boolean
}

export interface Badge {
  id: string
  kind: string
  awarded_at: string
}

export type TicketStatus = 'pending' | 'processing' | 'feedback'

export interface Ticket {
  id: string
  item_id: string
  requester_user_id: string
  assignee_user_id: string | null
  status: TicketStatus
  route_authorized: boolean
  result: string | null
  created_at: string
}

export const ticketStatusLabels: Record<TicketStatus, string> = {
  pending: '待接单',
  processing: '处理中',
  feedback: '已反馈',
}

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'completed'

export interface Claim {
  id: string
  found_item_id: string
  lost_item_id: string | null
  status: ClaimStatus
  created_at: string
  applicant_user_id: string
  reviewer_user_id: string | null
}

export interface ClaimDetail extends Claim {
  evidence: { kind: EvidenceKind; content: string }[]
  review_reason: string | null
}

export const claimStatusLabels: Record<ClaimStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  completed: '已完成',
}

export interface Candidate {
  found_item_id: string
  score: number
  explanation: string
  source: 'simulated' | 'rule' | 'cache' | 'model'
  title: string
  category: string
  location_area: string
}
export interface CommentAuthor {
  id: string
  display_name: string
  role_label: string
  title: string
}

export interface Comment {
  id: string
  item_id: string
  author: CommentAuthor
  content: string
  parent_id: string | null
  is_deleted: boolean
  is_hidden?: boolean
  images: Photo[]
  created_at: string
  replies: Comment[]
}

export interface Reaction {
  liked: boolean
  favorited: boolean
  like_count: number
  favorite_count: number
}
export interface HelperUser {
  id: string
  display_name: string
  title: string
  thanked: boolean
}

export interface HelperState {
  helper_count: number
  is_helper: boolean
}
export type HelperStatus = 'active' | 'abandoned'

export interface HelpingItem extends Item {
  helper_id: string
  helper_status: HelperStatus
  thanked: boolean
  taken_at: string
}

export interface MyComment {
  id: string
  item_id: string
  item_title: string
  content: string
  created_at: string
}

export interface MyClaim extends Claim {
  item_title: string
}

export const helperStatusLabels: Record<HelperStatus, string> = {
  active: '进行中',
  abandoned: '已放弃',
}

export function pointProgress(total: number, nextThreshold: number | null): number {
  if (nextThreshold == null) return 1
  const ratio = total / nextThreshold
  return Math.min(Math.max(ratio, 0), 1)
}

export interface Announcement {
  id: string
  title: string
  content: string
  is_pinned: boolean
  author_name: string | null
  created_at: string
  updated_at: string
  favorite_count: number
  is_favorited: boolean
}

export interface AnnouncementFavorite {
  id: string
  title: string
  created_at: string
  favorited_at: string
}

export interface Praise {
  id: string
  content: string
  item_id: string | null
  item_title: string | null
  from_user_id: string
  from_name: string
  to_user_id: string
  to_name: string
  created_at: string
  can_edit: boolean
}

export interface ModerationComment {
  id: string
  item_id: string
  item_title: string
  author_id: string
  author_name: string
  content: string
  is_hidden: boolean
  is_deleted: boolean
  created_at: string
}