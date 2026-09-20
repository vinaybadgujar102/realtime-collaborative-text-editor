import { clearToken, getToken } from '#/lib/auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export type ApiSuccess<T> = {
  success: true
  message: string
  data?: T
}

export type ApiError = {
  success: false
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export class ApiClientError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  auth?: boolean
}

export async function apiClient<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, headers: customHeaders, ...rest } = options

  const headers = new Headers(customHeaders)
  if (body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (auth) {
    const token = getToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let json: ApiResponse<T> | null = null
  const text = await response.text()
  if (text) {
    try {
      json = JSON.parse(text) as ApiResponse<T>
    } catch {
      throw new ApiClientError(
        text || `Request failed with status ${response.status}`,
        response.status,
      )
    }
  }

  if (!response.ok || (json && json.success === false)) {
    const message =
      json && json.success === false
        ? json.error
        : `Request failed with status ${response.status}`

    if (response.status === 403 || response.status === 401) {
      clearToken()
    }

    throw new ApiClientError(message, response.status)
  }

  if (!json || json.success !== true) {
    throw new ApiClientError('Unexpected empty response', response.status)
  }

  return json.data as T
}
