"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { FileText, Plus } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { format } from "date-fns"

interface PurchaseSummary {
  id: number
  invoice_number: string
  supplier_name: string
  purchase_date: string
  total_qty: number
  created_by_name?: string
}

interface PurchaseDetail {
  purchase: {
    invoice_number: string
    supplier_name: string
    purchase_date: string
    notes?: string
    created_by_name?: string
  }
  items: {
    id: number
    product_code: string
    product_name: string
    unit: string
    quantity: number
    unit_price: number
  }[]
}

export default function StockInPage() {
  const [history, setHistory] = useState<PurchaseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PurchaseDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const res = await api.get("/api/purchases")
      setHistory(res)
    } catch (err) {
      console.error("Failed to load purchases:", err)
    } finally {
      setLoading(false)
    }
  }

  const openDetail = async (id: number) => {
    setLoadingDetail(true)
    try {
      const res = await api.get(`/api/purchases/${id}`)
      setSelected(res)
    } catch (err) {
      alert("โหลดรายละเอียดไม่สำเร็จ")
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="รับสินค้าเข้า" />

        <main className="flex-1 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">เลือกประเภทการรับสินค้า</h3>
            <p className="text-gray-600">เลือกวิธีการเพิ่มสต๊อกสินค้า</p>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mt-4">
              <Link
                href="/stock-in/purchase"
                className="bg-white p-6 rounded-xl border border-gray-200 hover:border-green-500 hover:shadow-lg transition-all group"
              >
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-600 transition-colors">
                  <FileText className="w-7 h-7 text-green-600 group-hover:text-white" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">บิลซื้อเข้า</h4>
                <p className="text-gray-600 text-sm">รับสินค้าจาก Supplier พร้อมบันทึกเลขที่บิลและราคา</p>
              </Link>

              <Link
                href="/stock-in/manual"
                className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all group"
              >
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                  <Plus className="w-7 h-7 text-blue-600 group-hover:text-white" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">เพิ่ม Manual</h4>
                <p className="text-gray-600 text-sm">เพิ่มสต๊อกโดยตรงโดยไม่ต้องมีบิลอ้างอิง</p>
              </Link>
            </div>
          </div>

          {/* History */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">ประวัติการรับสินค้าเข้า</h4>
              <p className="text-sm text-gray-600">แสดงว่ารับจากบริษัทอะไร จำนวนเท่าไหร่ และผู้ทำรายการ</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขบิล</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">จำนวนรวม</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ทำรายการ</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        กำลังโหลด...
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        ไม่มีประวัติรับสินค้า
                      </td>
                    </tr>
                  ) : (
                    history.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.invoice_number}</td>
                        <td className="px-4 py-3 text-gray-700">{row.supplier_name || "-"}</td>
                        <td className="px-4 py-3 text-gray-700">{format(new Date(row.purchase_date), "dd/MM/yyyy")}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{row.total_qty}</td>
                        <td className="px-4 py-3 text-gray-700">{row.created_by_name || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openDetail(row.id)}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            ดูรายละเอียด
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">รายละเอียดบิลซื้อเข้า</h3>
                <p className="text-sm text-gray-600">เลขที่: {selected.purchase.invoice_number}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-700">
                ปิด
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p><strong>Supplier:</strong> {selected.purchase.supplier_name || "-"}</p>
                <p><strong>วันที่:</strong> {format(new Date(selected.purchase.purchase_date), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <p><strong>ผู้ทำรายการ:</strong> {selected.purchase.created_by_name || "-"}</p>
                {selected.purchase.notes && <p><strong>หมายเหตุ:</strong> {selected.purchase.notes}</p>}
              </div>
            </div>
            {loadingDetail ? (
              <p className="text-center text-gray-500">กำลังโหลด...</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">สินค้า</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">ราคา/หน่วย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selected.items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">{it.product_name}</div>
                          <div className="text-xs text-gray-500">{it.product_code}</div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 font-medium">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900">
                          {it.unit_price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
