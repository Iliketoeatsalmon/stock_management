"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, resolveUploadUrl } from "@/lib/api"
import { ArrowDownToLine, Download, Eye, FileText, Plus, Trash2, X } from "lucide-react"

interface PurchaseSummary {
  id: number
  invoice_number: string
  supplier_name?: string
  purchase_date: string
  total_qty?: number
  total_amount?: number
  created_by_name?: string
}

interface PurchaseDetailItem {
  product_code: string
  product_name: string
  quantity: number
  unit_price: number
  unit?: string
}

interface PurchaseDetail {
  purchase: {
    id: number
    invoice_number: string
    supplier_name?: string
    purchase_date: string
    notes?: string
    created_by_name?: string
    attachment_url?: string
  }
  items: PurchaseDetailItem[]
}

export default function StockInPage() {
  const [history, setHistory] = useState<PurchaseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<PurchaseDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [currentRole, setCurrentRole] = useState("")

  useEffect(() => {
    loadHistory()
    const userData = localStorage.getItem("user")
    if (userData) {
      try {
        const parsed = JSON.parse(userData)
        setCurrentRole(parsed?.role || "")
      } catch {
        setCurrentRole("")
      }
    }
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const result = await api.get("/purchases")
      setHistory(result)
    } catch (err) {
      console.error("Failed to load purchases:", err)
    } finally {
      setLoading(false)
    }
  }

  const openDetail = async (purchaseId: number) => {
    setDetailOpen(true)
    setSelected(null)
    setLoadingDetail(true)
    try {
      const result = await api.get(`/purchases/${purchaseId}`)
      setSelected(result)
    } catch (err) {
      console.error("Failed to load purchase detail:", err)
      alert("ไม่สามารถโหลดรายละเอียดบิลได้")
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setSelected(null)
  }

  const handleDeletePurchase = async () => {
    if (!selected) return
    const confirmed = confirm(`ลบบิลซื้อเข้า ${selected.purchase.invoice_number} ?`)
    if (!confirmed) return
    try {
      await api.delete(`/purchases/${selected.purchase.id}`)
      closeDetail()
      loadHistory()
    } catch (err) {
      console.error("Failed to delete purchase:", err)
      alert("ลบบิลไม่สำเร็จ")
    }
  }

  const getAttachmentUrls = (raw?: string | null) => {
    if (!raw) return []
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      }
      if (typeof parsed === "string" && parsed.trim()) {
        return [parsed]
      }
    } catch {
      // Ignore parse errors and fallback to raw value.
    }
    return [trimmed]
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="รับสินค้าเข้า" />

        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-gray-900">รับสินค้าเข้า</h1>
            <p className="text-sm text-gray-600">บันทึกบิลซื้อเข้าและดูประวัติการรับสินค้า</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/stock-in/purchase"
              className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
            >
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                <ArrowDownToLine className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-green-900">บันทึกบิลซื้อเข้า (Supplier)</p>
                <p className="text-sm text-green-700">รับสินค้าเข้าจากผู้ขาย</p>
              </div>
            </Link>

            <Link
              href="/stock-in/manual"
              className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-blue-900">เพิ่มสินค้าเข้าแบบ Manual</p>
                <p className="text-sm text-blue-700">บันทึกการเพิ่มสินค้าเข้าแบบมือ</p>
              </div>
            </Link>
          </div>

          <div>
            <div className="bg-white rounded-t-xl md:rounded-xl md:rounded-b-none border border-gray-200 border-b-0 md:border-b px-4 md:px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">ประวัติการรับสินค้า (บิลซื้อเข้า)</h2>
            </div>

            <div className="hidden md:block bg-white rounded-b-xl border border-gray-200 border-t-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขที่บิล</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ซัพพลายเออร์</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">จำนวนรวม</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ทำรายการ</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>ยังไม่มีบิลซื้อเข้าในระบบ</p>
                      </td>
                    </tr>
                  ) : (
                    history.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{row.invoice_number}</td>
                        <td className="px-6 py-4 text-gray-600">{row.supplier_name || "-"}</td>
                        <td className="px-6 py-4 text-gray-600">
                          {row.purchase_date ? format(new Date(row.purchase_date), "dd/MM/yyyy") : "-"}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">{row.total_qty ?? 0}</td>
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

            {/* Mobile card list */}
            <div className="md:hidden bg-white rounded-b-xl border border-gray-200 border-t-0 divide-y divide-gray-200">
              {loading ? (
                <div className="py-12 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>ยังไม่มีบิลซื้อเข้าในระบบ</p>
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
                      <p className="font-semibold text-gray-900 text-sm">{row.invoice_number}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {row.purchase_date ? format(new Date(row.purchase_date), "dd/MM/yyyy") : "-"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{row.supplier_name || "-"}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>ผู้ทำ: {row.created_by_name || "-"}</span>
                      <span className="font-medium text-gray-700">จำนวน {row.total_qty ?? 0}</span>
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
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">รายละเอียดบิลซื้อเข้า</h3>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  เลขที่: {selected?.purchase.invoice_number || "-"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {currentRole === "admin" && selected && (
                  <button
                    type="button"
                    onClick={handleDeletePurchase}
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">ลบบิล</span>
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
                      <p className="font-semibold text-gray-900">ซัพพลายเออร์</p>
                      <p>{selected.purchase.supplier_name || "-"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">วันที่</p>
                      <p>
                        {selected.purchase.purchase_date
                          ? format(new Date(selected.purchase.purchase_date), "dd/MM/yyyy")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">ผู้ทำรายการ</p>
                      <p>{selected.purchase.created_by_name || "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="font-semibold text-gray-900">หมายเหตุ</p>
                      <p className="text-gray-600">{selected.purchase.notes || "-"}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">รูปบิล</h4>
                    {getAttachmentUrls(selected.purchase.attachment_url).length === 0 ? (
                      <p className="text-sm text-gray-500">ไม่มีรูปบิล</p>
                    ) : (
                      <div className="flex flex-wrap gap-4">
                        {getAttachmentUrls(selected.purchase.attachment_url).map((url, idx) => {
                          const resolved = resolveUploadUrl(url)
                          return (
                            <div key={`${resolved}-${idx}`} className="w-40">
                              <div className="w-40 h-40 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                                <img src={resolved} alt={`bill-${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                              <a
                                href={resolved}
                                download
                                className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                              >
                                <Download className="w-4 h-4" />
                                ดาวน์โหลด
                              </a>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สินค้า</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ราคา/หน่วย</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selected.items.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                              ไม่มีรายการสินค้า
                            </td>
                          </tr>
                        ) : (
                          selected.items.map((item, idx) => (
                            <tr key={`${item.product_code}-${idx}`}>
                              <td className="px-4 py-3 text-gray-700">
                                {item.product_code} - {item.product_name}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-700">
                                {item.quantity} {item.unit || ""}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-700">
                                {item.unit_price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">ไม่พบข้อมูลบิล</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
