import { BASE_PATH, withBasePath } from "@/lib/base-path"

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
  logo: withBasePath("/logo-delivery.png"),
}

export function loadCompanySettings(): CompanySettings {
  if (typeof window === "undefined") return defaultSettings
  const raw = localStorage.getItem("companySettings")
  if (!raw) return defaultSettings
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
