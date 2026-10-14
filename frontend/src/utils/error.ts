import axios from 'axios'

export function errorMessage(error: unknown, fallback = '请求失败，请重试'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    const detail = data?.details?.[0]?.msg
    return data?.message ? data.message + (detail ? '：' + detail : '') : fallback
  }
  return fallback
}