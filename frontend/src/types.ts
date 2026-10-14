export type Direction = 'lost' | 'found'
export type ItemStatus = 'searching' | 'reviewing' | 'found' | 'withdrawn' | 'pending' | 'returned'
export type Source = 'manual' | 'rule' | 'cache' | 'model'
export type Role = 'student' | 'staff' | 'admin'
export type RouteKind = 'polyline' | 'circle'
export type EvidenceKind = 'text' | 'image'

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
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
  source: Source
  created_at: string
  norm_x: number | null
  norm_y: number | null
  layer_id: string | null
  precise_location?: string | null
  is_owner?: boolean
}

export const statusLabels: Record<ItemStatus, string> = {
  searching: '寻找中',
  reviewing: '核验中',
  found: '已找回',
  withdrawn: '已撤销',
  pending: '待认领',
  returned: '已归还',
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
}

export interface Layer {
  id: string
  name: string
  version: string
  width: number
  height: number
  scale_calibrated: boolean
  image_path: string | null
}

export interface SimulatedPoint {
  id: string
  label: string
  norm_x: number
  norm_y: number
  is_simulated: boolean
  description: string | null
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
