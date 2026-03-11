import Constants from 'expo-constants'
import { getToken, clearToken } from './auth'

const BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'https://giftist.ai'

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options
  const headers = new Headers(fetchOptions.headers)

  if (!skipAuth) {
    const token = await getToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  })

  if (res.status === 401) {
    await clearToken()
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data)
  }

  // Handle empty responses
  const text = await res.text()
  if (!text) return undefined as T

  return JSON.parse(text) as T
}

// Convenience methods
export const apiGet = <T = any>(path: string) => api<T>(path)

export const apiPost = <T = any>(path: string, body?: any) =>
  api<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })

export const apiPatch = <T = any>(path: string, body?: any) =>
  api<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  })

export const apiDelete = <T = any>(path: string, body?: any) =>
  api<T>(path, {
    method: 'DELETE',
    body: body ? JSON.stringify(body) : undefined,
  })

export { ApiError, BASE_URL }
