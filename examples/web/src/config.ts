const DEFAULT_API_BASE_URL = 'http://127.0.0.1:4010'

export const config = Object.freeze({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
})
