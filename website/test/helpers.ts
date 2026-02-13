import { NextRequest } from 'next/server'

export function createRequest(
  url: string,
  options?: {
    method?: string
    body?: any
    headers?: Record<string, string>
  }
): NextRequest {
  const { method = 'GET', body, headers = {} } = options || {}
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`

  const init: RequestInit = { method, headers }
  if (body) {
    init.body = JSON.stringify(body)
    ;(init.headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  return new NextRequest(fullUrl, init)
}

export const TEST_USER = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  phone: '15551234567',
}
