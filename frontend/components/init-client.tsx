"use client"

import { useEffect } from "react"
import { API_URL } from "@/lib/api"

function normalizeString(s: string) {
  if (!s) return s
  // remove duplicate /api segments like /api/api/uploads/...
  s = s.replace(/\/api\/(?:api\/)+/g, "/api/")
  // if someone stored the API_URL twice (e.g. "/api/api/uploads/..."), remove duplicates
  try {
    const base = API_URL.replace(/\/+$/, "")
    const double = `${base}${base}`
    if (s.startsWith(double)) {
      s = s.replace(double, base)
    }
  } catch {}
  return s
}

function traverseAndNormalize(obj: any): any {
  if (obj == null) return obj
  if (typeof obj === "string") return normalizeString(obj)
  if (Array.isArray(obj)) return obj.map(traverseAndNormalize)
  if (typeof obj === "object") {
    const out: any = {}
    for (const k of Object.keys(obj)) {
      out[k] = traverseAndNormalize(obj[k])
    }
    return out
  }
  return obj
}

export default function InitClient() {
  useEffect(() => {
    try {
      // Normalize company settings (common place storing logo)
      const raw = localStorage.getItem("companySettings")
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          const fixed = traverseAndNormalize(parsed)
          const fixedRaw = JSON.stringify(fixed)
          if (fixedRaw !== raw) {
            localStorage.setItem("companySettings", fixedRaw)
          }
        } catch {}
      }

      // Scan all localStorage values and normalize common URL duplication (/api/api)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        const val = localStorage.getItem(key)
        if (!val) continue
        // Only attempt to modify JSON or simple strings
        let changed = false
        // Try JSON
        try {
          const parsed = JSON.parse(val)
          const fixed = traverseAndNormalize(parsed)
          const fixedRaw = JSON.stringify(fixed)
          if (fixedRaw !== val) {
            localStorage.setItem(key, fixedRaw)
            changed = true
          }
        } catch {
          // Not JSON — treat as simple string
          const fixed = normalizeString(val)
          if (fixed !== val) {
            localStorage.setItem(key, fixed)
            changed = true
          }
        }
        if (changed) {
          // no-op; just proceed
        }
      }
    } catch (e) {
      // swallow errors — don't block app
      console.error("InitClient normalization failed:", e)
    }
  }, [])

  return null
}
