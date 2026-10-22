import client from './client'
import type { Photo } from '../types'

export async function uploadPhoto(file: File): Promise<Photo> {
  const form = new FormData()
  form.append('file', file)
  const res = await client.post<Photo>('/uploads', form)
  return res.data
}

export async function fetchPhotoUrl(url: string): Promise<string> {
  const res = await client.get<Blob>(url, { baseURL: '', responseType: 'blob' })
  return URL.createObjectURL(res.data)
}