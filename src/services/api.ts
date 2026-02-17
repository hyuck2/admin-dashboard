export async function apiClient<T = unknown>(
  method: string,
  path: string,
  options?: { body?: unknown; query?: Record<string, string>; pathParams?: string[] },
): Promise<T> {
  // Build URL: pathParams are appended as path segments (e.g., /users + [1] → /users/1)
  let fullPath = `/api${path}`
  if (options?.pathParams?.length) {
    fullPath += `/${options.pathParams.join('/')}`
  }

  const url = new URL(fullPath, window.location.origin)

  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value)
    }
  }

  const headers: Record<string, string> = {}
  const token = localStorage.getItem('token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url.toString(), {
    method: method.toUpperCase(),
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiError(response.status, errorData.detail ?? errorData.message ?? 'Error')
  }

  return await response.json() as T
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
