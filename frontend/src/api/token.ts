let token: string | null = null

export function setToken(value: string | null) {
  token = value
}

export function getToken(): string | null {
  return token
}