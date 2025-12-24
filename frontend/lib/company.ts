import { BASE_PATH, withBasePath } from "@/lib/base-path"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export type CompanySettings = {
  nameTh: string
  nameEn: string
  address: string
  taxId: string
  tel: string
  fax: string
  logo: string
}

const normalizeLogoPath = (logo: string) => {
  if (!logo) return logo
  if (logo.startsWith("http")) return logo
  const apiBase = API_BASE.replace(/\/$/, "")
  // If logo is served from backend API, keep absolute path as-is
  if (logo.startsWith("/api")) return logo
  // Normalize legacy upload URLs to API proxy path
  if (logo.startsWith("/uploads")) return `${apiBase}${logo}`
  if (BASE_PATH && logo.startsWith(`${BASE_PATH}/uploads`)) {
    return `${apiBase}${logo.slice(BASE_PATH.length)}`
  }
  if (!BASE_PATH) return logo
  if (logo === BASE_PATH || logo.startsWith(`${BASE_PATH}/`)) return logo
  return logo.startsWith("/") ? `${BASE_PATH}${logo}` : `${BASE_PATH}/${logo}`
}

const defaultSettings: CompanySettings = {
  nameTh: "บริษัทของคุณ",
  nameEn: "Your Company Co., Ltd.",
  address: "ที่อยู่บริษัท, จังหวัด, รหัสไปรษณีย์",
  taxId: "TAX ID: -",
  tel: "โทร. -",
  fax: "แฟกซ์ -",
  // Use an existing uploaded image as the default delivery logo
  logo: withBasePath("/uploads/a44d90deb308402f8b5cef593da23b87.png"),
}

export function loadCompanySettings(): CompanySettings {
  if (typeof window === "undefined") return defaultSettings
  const raw = localStorage.getItem("companySettings")
  if (!raw) return { ...defaultSettings, logo: normalizeLogoPath(defaultSettings.logo) }
  try {
    const parsed = JSON.parse(raw)
    const merged = { ...defaultSettings, ...parsed }
    return { ...merged, logo: normalizeLogoPath(merged.logo) }
  } catch {
    return defaultSettings
  }
}

export function saveCompanySettings(settings: CompanySettings) {
  if (typeof window === "undefined") return
  localStorage.setItem("companySettings", JSON.stringify(settings))
}

export { defaultSettings }
