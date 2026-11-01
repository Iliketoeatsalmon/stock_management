"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"

export interface ProductOption {
  id: number
  code: string
  name: string
  unit?: string
  current_stock?: number
  /** รหัสก่อนรันรหัสใหม่ ให้พนักงานที่จำรหัสเดิมยังค้นเจอ */
  legacy_code?: string | null
}

interface ProductSelectProps {
  products: ProductOption[]
  value: number
  onChange: (productId: number) => void
  placeholder?: string
  className?: string
  showStock?: boolean
  disabled?: boolean
}

/**
 * Dropdown เลือกสินค้าที่พิมพ์ค้นหาได้ (ค้นจากรหัสหรือชื่อ)
 * ใช้แทน <select> ปกติในหน้าที่มีสินค้าจำนวนมาก
 */
export function ProductSelect({
  products,
  value,
  onChange,
  placeholder = "เลือกสินค้า",
  className = "",
  showStock = false,
  disabled = false,
}: ProductSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = products.find((p) => p.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    // รองรับพิมพ์หลายคำ เช่น "ถุง ดำ" ต้องเจอทุกคำ
    const terms = q.split(/\s+/)
    return products.filter((p) => {
      const haystack = `${p.code} ${p.legacy_code ?? ""} ${p.name}`.toLowerCase()
      return terms.every((t) => haystack.includes(t))
    })
  }, [products, query])

  // ปิดเมื่อคลิกนอกกล่อง
  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery("")
      setHighlight(0)
      // โฟกัสช่องค้นหาทันทีที่เปิด จะได้พิมพ์ได้เลย
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  // เลื่อนรายการที่ไฮไลต์ให้อยู่ในระยะมองเห็น
  useEffect(() => {
    if (!open || !listRef.current) return
    const node = listRef.current.children[highlight] as HTMLElement | undefined
    node?.scrollIntoView({ block: "nearest" })
  }, [highlight, open])

  const choose = (productId: number) => {
    onChange(productId)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = filtered[highlight]
      if (item) choose(item.id)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-left text-slate-900 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 ${className}`}
      >
        <span className={`truncate ${selected ? "" : "text-slate-500"}`}>
          {selected ? `${selected.code} - ${selected.name}` : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="พิมพ์ค้นหา รหัส หรือ ชื่อสินค้า"
                className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    inputRef.current?.focus()
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <ul ref={listRef} className="max-h-64 overflow-y-auto py-1 text-sm">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-gray-500">ไม่พบสินค้าที่ค้นหา</li>
            ) : (
              filtered.map((p, idx) => (
                <li
                  key={p.id}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => choose(p.id)}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
                    idx === highlight ? "bg-blue-50" : ""
                  }`}
                >
                  <Check
                    className={`w-4 h-4 flex-shrink-0 ${p.id === value ? "text-blue-600" : "text-transparent"}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900">{p.code}</span>
                    <span className="text-gray-600"> - {p.name}</span>
                    {p.legacy_code && p.legacy_code !== p.code && (
                      <span className="text-xs text-gray-400"> (เดิม {p.legacy_code})</span>
                    )}
                  </span>
                  {showStock && p.current_stock !== undefined && (
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      คงเหลือ {p.current_stock} {p.unit || ""}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>

          <div className="px-3 py-1.5 border-t border-gray-100 text-xs text-gray-500">
            {filtered.length} จาก {products.length} รายการ
          </div>
        </div>
      )}
    </div>
  )
}
