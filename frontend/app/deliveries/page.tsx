"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { Plus, Eye, Truck, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { DatePicker } from "@/components/ui/date-picker"

interface Delivery {
  id: number
  delivery_number: string
  customer_name: string
  delivery_date: string
  status: string
  created_at: string
  created_by_name?: string
}

const PAGE_SIZE = 20

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [dateFilter, setDateFilter] = useState({ start_date: "", end_date: "" })

  useEffect(() => {
    loadDeliveries()
  }, [])

  const loadDeliveries = async (overrideFilter?: { start_date: string; end_date: string }) => {
    const activeFilter = overrideFilter || dateFilter
    setError("")
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeFilter.start_date) params.append("start_date", activeFilter.start_date)
      if (activeFilter.end_date) params.append("end_date", activeFilter.end_date)
      const endpoint = params.toString() ? `/deliveries?${params.toString()}` : "/deliveries"
      const result = await api.get(endpoint)
      setDeliveries(result)
      setPage(1)
    } catch (err) {
      setError("โหลดข้อมูลใบส่งของไม่ได้ กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">Draft</span>
      case "confirmed": return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">ยืนยันแล้ว</span>
      case "cancelled": return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">ยกเลิก</span>
      default: return null
    }
  }

  const totalPages = Math.ceil(deliveries.length / PAGE_SIZE)
  const paged = deliveries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="ใบส่งของ" />
        <main className="flex-1 p-4 sm:p-6">

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{deliveries.length} รายการ</p>
            <Link href="/deliveries/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Plus className="w-4 h-4" />สร้างใบส่งของ
            </Link>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {/* Filter */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-36">
                <label className="block text-xs text-gray-500 mb-1">จากวันที่</label>
                <DatePicker value={dateFilter.start_date} onChange={(v) => setDateFilter({ ...dateFilter, start_date: v })} className="px-3 py-2" />
              </div>
              <div className="flex-1 min-w-36">
                <label className="block text-xs text-gray-500 mb-1">ถึงวันที่</label>
                <DatePicker value={dateFilter.end_date} onChange={(v) => setDateFilter({ ...dateFilter, end_date: v })} className="px-3 py-2" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => loadDeliveries()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">ค้นหา</button>
                <button onClick={() => { const c = { start_date: "", end_date: "" }; setDateFilter(c); loadDeliveries(c) }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">ล้าง</button>
              </div>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขที่ใบส่งของ</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลูกค้า</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ทำรายการ</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่ส่ง</th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={6} className="py-12 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-500"><Truck className="w-12 h-12 mx-auto mb-2 text-gray-300" /><p>ยังไม่มีใบส่งของ</p></td></tr>
                ) : paged.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900 text-sm">{d.delivery_number}</td>
                    <td className="px-5 py-3 text-gray-600 text-sm">{d.customer_name}</td>
                    <td className="px-5 py-3 text-gray-500 text-sm">{d.created_by_name || "-"}</td>
                    <td className="px-5 py-3 text-gray-600 text-sm">{format(new Date(d.delivery_date), "dd/MM/yyyy")}</td>
                    <td className="px-5 py-3 text-center">{getStatusBadge(d.status)}</td>
                    <td className="px-5 py-3 text-center">
                      <Link href={`/deliveries/${d.id}`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg inline-flex">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="py-12 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
            ) : paged.length === 0 ? (
              <div className="py-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
                <Truck className="w-12 h-12 mx-auto mb-2 text-gray-300" /><p>ยังไม่มีใบส่งของ</p>
              </div>
            ) : paged.map((d) => (
              <Link key={d.id} href={`/deliveries/${d.id}`} className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-900 text-sm">{d.delivery_number}</p>
                  {getStatusBadge(d.status)}
                </div>
                <p className="text-gray-700 text-sm">{d.customer_name}</p>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>{format(new Date(d.delivery_date), "dd/MM/yyyy")}</span>
                  {d.created_by_name && <span>{d.created_by_name}</span>}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">หน้า {page}/{totalPages}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
