import axios from 'axios'
import { getToken } from './token'

const client = axios.create({
  baseURL: '/api/v1',
  // AI 聊天含模型调用 + 解析失败重试一次，最坏 2×模型超时；普通接口远快于此值
  timeout: 30000,
})

client.interceptors.request.use((config) => {
  const token = getToken()
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

export default client
