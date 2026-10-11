import axios from 'axios'

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
})

let token: string | null = null

export function setToken(value: string | null) {
  token = value
}

export function getToken(): string | null {
  return token
}

client.interceptors.request.use((config) => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config?.headers?.Authorization &&
      !error.config?.url?.includes('/auth/login')
    ) {
      window.dispatchEvent(new Event('auth-expired'))
    }
    return Promise.reject(error)
  },
)

export function errorMessage(error: unknown, fallback = '请求失败，请重试'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    const detail = data?.details?.[0]?.msg
    return data?.message ? data.message + (detail ? '：' + detail : '') : fallback
  }
  return fallback
}

export default client
