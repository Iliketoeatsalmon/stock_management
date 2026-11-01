"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, BellOff } from "lucide-react"
import { api } from "@/lib/api"
import { withBasePath } from "@/lib/base-path"

interface LowStockAlert {
  id: number
  code: string
  name: string
  unit: string
  min_stock: number
  current_stock: number
  notify_enabled: boolean
}

const POLL_INTERVAL_MS = 60000

export function NotificationBell() {
  const [alerts, setAlerts] = useState<LowStockAlert[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const data = await api.get("/dashboard")
      const products: LowStockAlert[] = data?.low_stock_products || []
      setAlerts(products.filter((p) => p.notify_enabled))
    } catch {
      // Silently ignore — the bell just won't update this cycle.
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const muteAlert = async (id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    try {
      await api.put(`/products/${id}`, { notify_enabled: false })
    } catch {
      load()
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        aria-label="แจ้งเตือนสินค้าใกล้หมด"
      >
        <Bell className="w-5 h-5" />
        {alerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {alerts.length > 99 ? "99+" : alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">แจ้งเตือนสินค้าใกล้หมด</h4>
            <span className="text-xs text-gray-400">{alerts.length} รายการ</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">ไม่มีการแจ้งเตือน</p>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="px-4 py-2.5 border-b border-gray-50 flex items-center gap-2 hover:bg-gray-50">
                  <Link href={withBasePath(`/products/${a.id}`)} className="min-w-0 flex-1" onClick={() => setOpen(false)}>
                    <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                    <p className="text-xs text-gray-500">
                      {a.code} · เหลือ {a.current_stock} {a.unit} (ขั้นต่ำ {a.min_stock})
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => muteAlert(a.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0"
                    title="ปิดแจ้งเตือนสินค้านี้"
                  >
                    <BellOff className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
          <Link
            href={withBasePath("/dashboard")}
            onClick={() => setOpen(false)}
            className="block text-center text-sm text-blue-600 hover:bg-blue-50 py-2.5 border-t border-gray-100"
          >
            ดูทั้งหมดที่แดชบอร์ด
          </Link>
        </div>
      )}
    </div>
  )
}
