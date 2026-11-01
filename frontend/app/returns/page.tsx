"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { Eye, FileText, Plus, RefreshCcw, Trash2, Undo2, X } from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"
import { formatQty } from "@/lib/units"

interface ReturnSummary {
  id: number
  return_number: string
  customer_name?: string
  site_name?: string
  return_date: string
  notes?: string
  total_qty?: number
  item_count?: number
  created_by_name?: string
}

interface ReturnDetailItem {
  product_code: string
  product_name: string
  quantity: number
  unit?: string
  note?: string
}

interface ReturnDetail {
  return: ReturnSummary
  items: ReturnDetailItem[]
}

export default function ReturnsPage() {
  const [history, setHistory] = useState<ReturnSummary[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<ReturnDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [currentRole, setCurrentRole] = useState("")

  const [useDateRange, setUseDateRange] = useState(false)
  const [filter, setFilter] = useState({
    customer_id: 0,
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    loadHistory()
    loadCustomers()
    const userData = localStorage.getItem("user")
    if (userData) {
      try {
        setCurrentRole(JSON.parse(userData)?.role || "")
      } catch {
        setCurrentRole("")
      }
    }
  }, [])

  const loadCustomers = async () => {
    try {
      setCustomers(await api.get("/customers"))
    } catch (err) {
      console.error("Failed to load customers:", err)
    }
  }

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.customer_id) params.append("customer_id", String(filter.customer_id))
      if (useDateRange && filter.start_date) params.append("start_date", filter.start_date)
      if (useDateRange && filter.end_date) params.append("end_date", filter.end_date)
      const query = params.toString()
      setHistory(await api.get(`/returns${query ? `?${query}` : ""}`))
    } catch (err) {
      console.error("Failed to load returns:", err)
    } finally {
      setLoading(false)
    }
  }

  const openDetail = async (returnId: number) => {
    setDetailOpen(true)
    setSelected(null)
    setLoadingDetail(true)
    try {
      setSelected(await api.get(`/returns/${returnId}`))
    } catch (err) {
      console.error("Failed to load return detail:", err)
      alert("ไม่สามารถโหลดรายละเอียดได้")
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setSelected(null)
  }

  const handleDelete = async () => {
    if (!selected) return
    const ok = confirm(
      `ลบใบคืนของ ${selected.return.return_number} ?\nสต็อกที่รับคืนจากใบนี้จะถูกหักกลับคืนด้วย`,
    )
    if (!ok) return
    try {
      await api.delete(`/returns/${selected.return.id}`)
      closeDetail()
      loadHistory()
    } catch (err) {
      console.error("Failed to delete return:", err)
      alert("ลบใบคืนของไม่สำเร็จ")
    }
  }

  const sourceLabel = (row: { customer_name?: string; site_name?: string }) => {
    const parts = [row.customer_name, row.site_name].filter(Boolean)
    return parts.length ? parts.join(" / ") : "-"
  }

  const totalReturned = history.reduce((sum, r) => sum + (Number(r.total_qty) || 0), 0)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="คืนของ" />

        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold text-gray-900">คืนของจากหน้างาน</h1>
              <p className="text-sm text-gray-600">รับของที่ส่งกลับมาเข้าสต็อก และดูประวัติว่าคืนอะไรมาบ้าง</p>
            </div>
            <Link
              href="/returns/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              บันทึกการคืน
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">หน่วยงาน</label>
                <select
                  value={filter.customer_id}
                  onChange={(e) => setFilter({ ...filter, customer_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value={0}>ทั้งหมด</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useDateRange}
                    onChange={(e) => setUseDateRange(e.target.checked)}
                    className="w-4 h-4"
                  />
                  กรองตามช่วงเวลา
                </label>
              </div>
              <div className="flex items-end justify-end">
                <button
                  onClick={loadHistory}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  <RefreshCcw className="w-4 h-4" />
                  ค้นหา
                </button>
              </div>
              {useDateRange && (
                <>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">ตั้งแต่วันที่</label>
                    <DatePicker
                      value={filter.start_date}
                      onChange={(value) => setFilter({ ...filter, start_date: value })}
                      className="px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">ถึงวันที่</label>
                    <DatePicker
                      value={filter.end_date}
                      onChange={(value) => setFilter({ ...filter, end_date: value })}
                      className="px-3 py-2"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="bg-white rounded-t-xl md:rounded-xl md:rounded-b-none border border-gray-200 border-b-0 md:border-b px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">ประวัติการคืนของ</h2>
              <span className="text-sm text-gray-600">
                {history.length} ใบ | รวมรับคืน{" "}
                <span className="font-semibold text-green-700">{totalReturned.toLocaleString()}</span> ชิ้น
              </span>
            </div>

            {/* Desktop */}
            <div className="hidden md:block bg-white rounded-b-xl border border-gray-200 border-t-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขที่</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่คืน</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">มาจาก</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">รายการ</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">จำนวนรวม</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ทำรายการ</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        <Undo2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>ยังไม่มีประวัติการคืนของ</p>
                      </td>
                    </tr>
                  ) : (
                    history.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{row.return_number}</td>
                        <td className="px-6 py-4 text-gray-600">
                          {row.return_date ? format(new Date(row.return_date), "dd/MM/yyyy") : "-"}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{sourceLabel(row)}</td>
                        <td className="px-6 py-4 text-right text-gray-600">{row.item_count ?? 0}</td>
                        <td className="px-6 py-4 text-right font-semibold text-green-700">{formatQty(row.total_qty)}</td>
                        <td className="px-6 py-4 text-gray-600">{row.created_by_name || "-"}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => openDetail(row.id)}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Eye className="w-4 h-4" />
                            ดูรายละเอียด
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden bg-white rounded-b-xl border border-gray-200 border-t-0 divide-y divide-gray-200">
              {loading ? (
                <div className="py-12 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <Undo2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>ยังไม่มีประวัติการคืนของ</p>
                </div>
              ) : (
                history.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => openDetail(row.id)}
                    className="w-full text-left p-4 active:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-gray-900 text-sm">{row.return_number}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {row.return_date ? format(new Date(row.return_date), "dd/MM/yyyy") : "-"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{sourceLabel(row)}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>ผู้ทำ: {row.created_by_name || "-"}</span>
                      <span className="font-medium text-green-700">
                        {row.item_count ?? 0} รายการ / {formatQty(row.total_qty)} ชิ้น
                      </span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600">
                      <Eye className="w-3.5 h-3.5" /> ดูรายละเอียด
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">รายละเอียดการคืนของ</h3>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  เลขที่: {selected?.return.return_number || "-"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {currentRole === "admin" && selected && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">ลบใบคืน</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeDetail}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">ปิด</span>
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-6">
              {loadingDetail ? (
                <p className="text-sm text-gray-500">กำลังโหลด...</p>
              ) : selected ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                    <div>
                      <p className="font-semibold text-gray-900">หน่วยงาน</p>
                      <p>{selected.return.customer_name || "-"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">ไซต์/หน้างาน</p>
                      <p>{selected.return.site_name || "-"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">วันที่คืน</p>
                      <p>
                        {selected.return.return_date
                          ? format(new Date(selected.return.return_date), "dd/MM/yyyy")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">ผู้ทำรายการ</p>
                      <p>{selected.return.created_by_name || "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="font-semibold text-gray-900">หมายเหตุ</p>
                      <p className="text-gray-600">{selected.return.notes || "-"}</p>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สินค้า</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selected.items.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                              ไม่มีรายการ
                            </td>
                          </tr>
                        ) : (
                          selected.items.map((item, idx) => (
                            <tr key={`${item.product_code}-${idx}`}>
                              <td className="px-4 py-3 text-gray-700">
                                {item.product_code} - {item.product_name}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-green-700">
                                +{formatQty(item.quantity)} {item.unit || ""}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{item.note || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {selected.items.length > 0 && (
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">รวม</td>
                            <td className="px-4 py-3 text-right font-bold text-green-700">
                              {selected.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0).toLocaleString()}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">ไม่พบข้อมูล</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
