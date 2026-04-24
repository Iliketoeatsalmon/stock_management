import { withBasePath } from "@/lib/base-path"

// 🔧 จุดสำคัญ: ให้ base URL รวม /api ไปเลย
// - เวลาใช้งานผ่าน nginx: NEXT_PUBLIC_API_BASE_URL = "http://stock.cleanovaworld.com/api"
// - เวลา dev ในเครื่อง: fallback = "http://localhost:8000/api"
export const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function readErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    const error = await res.json().catch(() => null)
    if (error?.detail) return String(error.detail)
    if (error?.message) return String(error.message)
    return fallback
  }

  const text = await res.text().catch(() => "")
  const normalized = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  return normalized || `${fallback} (${res.status})`
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  // endpoint must start with "/" such as "/auth/login", "/products"
  // Normalize to avoid double "/api" when callers pass "/api/..." while
  // `API_URL` already contains "/api" (e.g. "/api").
  const base = API_URL.replace(/\/$/, "")
  const normalizedEndpoint = endpoint.startsWith("/api") ? endpoint.replace(/^\/api/, "") : endpoint
  const url = `${base}${normalizedEndpoint}`

  const res = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      window.location.href = withBasePath("/")
    }
    throw new Error("Unauthorized")
  }

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "เกิดข้อผิดพลาด"))
  }

  return res.json()
}

export const api = {
  get: (endpoint: string) => fetchApi(endpoint),
  post: (endpoint: string, data: any) =>
    fetchApi(endpoint, { method: "POST", body: JSON.stringify(data) }),
  put: (endpoint: string, data: any) =>
    fetchApi(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  delete: (endpoint: string) => fetchApi(endpoint, { method: "DELETE" }),
  upload: async (endpoint: string, formData: FormData) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const base = API_URL.replace(/\/$/, "")
    const normalizedEndpoint = endpoint.startsWith("/api") ? endpoint.replace(/^\/api/, "") : endpoint
    const url = `${base}${normalizedEndpoint}`
    const res = await fetch(url, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, "อัปโหลดไฟล์ไม่สำเร็จ"))
    }
    return res.json()
  },
}

export function resolveUploadUrl(url: string) {
  if (!url) return ""
  if (url.startsWith("http")) return url
  if (url.startsWith("/api")) return url
  // Serve uploads through the API proxy (nginx routes /api/* to backend).
  if (url.startsWith("/uploads")) return `${API_URL.replace(/\/$/, "")}${url}`
  return `${API_URL}${url}`
}
