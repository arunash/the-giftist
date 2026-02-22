const BASE_URL = process.env.TEST_BASE_URL || 'https://giftist.ai'

export class ApiClient {
  constructor(
    private baseUrl: string,
    private token: string,
  ) {}

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    }

    let res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    // Retry once on 5xx (handles mid-deploy flakes)
    if (res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000))
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    return res
  }

  get(path: string) {
    return this.request('GET', path)
  }
  post(path: string, body?: unknown) {
    return this.request('POST', path, body)
  }
  patch(path: string, body?: unknown) {
    return this.request('PATCH', path, body)
  }
  delete(path: string) {
    return this.request('DELETE', path)
  }
}

let _client: ApiClient | null = null

export function initApiClient(token: string): ApiClient {
  _client = new ApiClient(BASE_URL, token)
  return _client
}

export function getClient(): ApiClient {
  if (!_client) throw new Error('ApiClient not initialized — setup.ts must run first')
  return _client
}

export function getBaseUrl(): string {
  return BASE_URL
}
