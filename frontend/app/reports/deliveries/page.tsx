"use client"

import { useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, API_URL } from "@/lib/api"
import { FileText, Printer, RefreshCcw } from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"

interface DeliveryRow {
  product_id: number
  product_code: string
  product_name: string
  unit?: string
  total_quantity: number
  delivery_count: number
}

const STATUS_OPTIONS = [
  { value: "confirmed", label: "ยืนยันแล้ว (ส่งจริง)" },
  { value: "", label: "ทุกสถานะ" },
  { value: "draft", label: "ร่าง" },
  { value: "cancelled", label: "ยกเลิก" },
]

export default function DeliveryReportPage() {
  const today = useMemo(() => new Date(), [])
  const firstDay = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    return d
  }, [])

  const [customers, setCustomers] = useState<any[]>([])
  const [useDateRange, setUseDateRange] = useState(false)
  const [filter, setFilter] = useState({
    customer_id: 0,
    start_date: firstDay.toISOString().split("T")[0],
    end_date: today.toISOString().split("T")[0],
    status: "confirmed",
  })
  const [data, setData] = useState<{ rows: DeliveryRow[]; total_quantity: number; delivery_count: number }>({
    rows: [],
    total_quantity: 0,
    delivery_count: 0,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCustomers()
    loadReport()
  }, [])

  const loadCustomers = async () => {
    try {
      const result = await api.get("/customers")
      setCustomers(result)
    } catch (err) {
      console.error("Failed to load customers:", err)
    }
  }

  const buildParams = () => {
    const params = new URLSearchParams()
    if (filter.customer_id) params.append("customer_id", String(filter.customer_id))
    if (useDateRange && filter.start_date) params.append("start_date", filter.start_date)
    if (useDateRange && filter.end_date) params.append("end_date", filter.end_date)
    if (filter.status) params.append("status", filter.status)
    return params
  }

  const loadReport = async () => {
    setLoading(true)
    try {
      const result = await api.get(`/api/reports/deliveries?${buildParams().toString()}`)
      setData(result)
    } catch (err) {
      console.error("Failed to load deliveries report:", err)
    } finally {
      setLoading(false)
    }
  }

  const printPdf = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const res = await fetch(`${API_URL}/reports/deliveries/pdf?${buildParams().toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error("Failed to load PDF")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
    } catch (err) {
      console.error("Failed to open report PDF:", err)
    }
  }

  const customerName = filter.customer_id
    ? customers.find((c) => c.id === filter.customer_id)?.name || "-"
    : "ทั้งหมด"
  const statusLabel = STATUS_OPTIONS.find((s) => s.value === filter.status)?.label || "-"

  const rangeText = useDateRange
    ? `${filter.start_date || "-"} ถึง ${filter.end_date || "-"}`
    : "ทั้งหมด"

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="รายงานการส่งของ (ตามหน่วยงาน)" />
        <main className="flex-1 p-4 sm:p-6 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">รายงานการส่งของ (ตามหน่วยงาน)</h3>
                <p className="text-xs sm:text-sm text-gray-600">สรุปว่าหน่วยงานนี้รับสิ่งของอะไรไปบ้าง รวมจำนวนทั้งหมด</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadReport}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">โหลดใหม่</span>
                </button>
                <button
                  onClick={printPdf}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  <Printer className="w-4 h-4" />
                  พิมพ์
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 sm:py-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">หน่วยงาน (ลูกค้า)</label>
                <select
                  value={filter.customer_id}
                  onChange={(e) => setFilter({ ...filter, customer_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value={0}>ทั้งหมด</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">สถานะ</label>
                <select
                  value={filter.status}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
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
              {useDateRange && (
                <>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">เริ่มวันที่</label>
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
              <div className="md:col-span-4 flex justify-end">
                <button
                  onClick={loadReport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={loading}
                >
                  ดึงรายงาน
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm text-gray-700 mb-2">
                <div>
                  หน่วยงาน: {customerName}
                  {" | "}ช่วง: {rangeText}
                  {" | "}สถานะ: {statusLabel}
                </div>
                <div className="font-semibold text-blue-700">
                  จำนวนใบส่งของ: {data.delivery_count?.toLocaleString()} | รวมจำนวน:{" "}
                  {data.total_quantity?.toLocaleString()} ชิ้น
                </div>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-200 px-3 py-2 w-10">ลำดับ</th>
                      <th className="border border-gray-200 px-3 py-2 w-28">รหัสสินค้า</th>
                      <th className="border border-gray-200 px-3 py-2">ชื่อสิ่งของ</th>
                      <th className="border border-gray-200 px-3 py-2 w-20">หน่วย</th>
                      <th className="border border-gray-200 px-3 py-2 w-28 text-right">จำนวนรวม</th>
                      <th className="border border-gray-200 px-3 py-2 w-24 text-center">จำนวนครั้ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          กำลังโหลด...
                        </td>
                      </tr>
                    ) : data.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          <FileText className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    ) : (
                      data.rows.map((row, idx) => (
                        <tr key={row.product_id} className="odd:bg-white even:bg-gray-50">
                          <td className="border border-gray-200 px-3 py-2 text-center">{idx + 1}</td>
                          <td className="border border-gray-200 px-3 py-2">{row.product_code}</td>
                          <td className="border border-gray-200 px-3 py-2">{row.product_name}</td>
                          <td className="border border-gray-200 px-3 py-2">{row.unit || "-"}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-900">
                            {row.total_quantity?.toLocaleString()}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-center">{row.delivery_count?.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-center print:mt-10">
                <div className="border border-gray-400 rounded-md overflow-hidden min-w-[50%]">
                  <div className="grid grid-cols-2 text-center text-sm font-semibold">
                    <div className="border-r border-gray-400 px-4 py-3 text-pink-600">รวมจำนวนทั้งสิ้น</div>
                    <div className="px-4 py-3 text-pink-600">{data.total_quantity?.toLocaleString()} ชิ้น</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
