import client from './client'
import type { Page, RouteKind, Ticket, TicketStatus } from '../types'

export interface TicketCreateInput {
  item_id: string
}

export interface FeedbackInput {
  result: string
}

export interface TicketRoute {
  id: string
  kind: RouteKind
  geometry: Record<string, unknown> | null
  floor_segments: unknown[] | null
}

export interface ListTicketsParams {
  status?: TicketStatus | null
  limit?: number
  offset?: number
}

export async function listTickets(params: ListTicketsParams = {}): Promise<Page<Ticket>> {
  const res = await client.get<Page<Ticket>>('/tickets', { params })
  return res.data
}

export async function createTicket(body: TicketCreateInput): Promise<Ticket> {
  const res = await client.post<Ticket>('/tickets', body)
  return res.data
}

export async function assignTicket(id: string): Promise<Ticket> {
  const res = await client.post<Ticket>(`/tickets/${id}/assign`)
  return res.data
}

export async function authorizeRoute(id: string): Promise<Ticket> {
  const res = await client.post<Ticket>(`/tickets/${id}/authorize-route`)
  return res.data
}

export async function getTicketRoute(id: string): Promise<TicketRoute[]> {
  const res = await client.get<TicketRoute[]>(`/tickets/${id}/route`)
  return res.data
}

export async function feedbackTicket(id: string, body: FeedbackInput): Promise<Ticket> {
  const res = await client.post<Ticket>(`/tickets/${id}/feedback`, body)
  return res.data
}