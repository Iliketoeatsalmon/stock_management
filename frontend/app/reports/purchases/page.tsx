"use client"

import { useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { FileText, Printer, RefreshCcw } from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"

interface PurchaseRow {
  id: number
  invoice_number: string
  purchase_date: string
  total_amount: number
  notes?: string
  supplier_name?: string
}

export default function PurchaseReportPage() {
  const today = useMemo(() => new Date(), [])
  const firstDay = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    return d
  }, [])

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [purchaseFilter, setPurchaseFilter] = useState({
    supplier_id: 0,
    start_date: firstDay.toISOString().split("T")[0],
    end_date: today.toISOString().split("T")[0],
  })
  const [purchaseData, setPurchaseData] = useState<{ rows: PurchaseRow[]; total_amount: number }>({ rows: [], total_amount: 0 })
  const [purchaseLoading, setPurchaseLoading] = useState(false)

  useEffect(() => {
    loadSuppliers()
    loadPurchases()
  }, [])

  const loadSuppliers = async () => {
    try {
      const result = await api.get("/api/suppliers")
      setSuppliers(result)
    } catch (err) {
      console.error("Failed to load suppliers:", err)
    }
  }

  const loadPurchases = async () => {
    setPurchaseLoading(true)
    try {
      const params = new URLSearchParams()
      if (purchaseFilter.supplier_id) params.append("supplier_id", String(purchaseFilter.supplier_id))
      if (purchaseFilter.start_date) params.append("start_date", purchaseFilter.start_date)
      if (purchaseFilter.end_date) params.append("end_date", purchaseFilter.end_date)
      const result = await api.get(`/api/reports/purchases?${params.toString()}`)
      setPurchaseData(result)
    } catch (err) {
      console.error("Failed to load purchases report:", err)
    } finally {
      setPurchaseLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("th-TH")
  }

  return (
    <div className="flex min-h-screen bg-gray-50 print:bg-white">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="print:hidden">
          <Header title="รายงานการซื้อ" />
        </div>
        <main className="flex-1 p-6 space-y-4 print:p-0 print:pt-4">
          <style>{`
            @media print {
              .print\\:hidden { display: none !important; }
              .print\\:block { display: block !important; }
              .print\\:shadow-none { box-shadow: none !important; border: none !important; }
              body { background: white !important; }
            }
          `}</style>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm print:shadow-none print:border print:border-gray-300 print:mx-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">รายงานการซื้อ (ตาม Supplier)</h3>
                <p className="text-sm text-gray-600">เลือกช่วงเวลาและ Supplier</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button
                  onClick={loadPurchases}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  <RefreshCcw className="w-4 h-4" />
                  โหลดใหม่
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  <Printer className="w-4 h-4" />
                  พิมพ์
                </button>
              </div>
            </div>

            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Supplier</label>
                <select
                  value={purchaseFilter.supplier_id}
                  onChange={(e) => setPurchaseFilter({ ...purchaseFilter, supplier_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value={0}>ทั้งหมด</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">เริ่มวันที่</label>
                <DatePicker
                  value={purchaseFilter.start_date}
                  onChange={(value) => setPurchaseFilter({ ...purchaseFilter, start_date: value })}
                  className="px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">ถึงวันที่</label>
                <DatePicker
                  value={purchaseFilter.end_date}
                  onChange={(value) => setPurchaseFilter({ ...purchaseFilter, end_date: value })}
                  className="px-3 py-2"
                />
              </div>
              <div className="md:col-span-4 flex justify-end">
                <button
                  onClick={loadPurchases}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={purchaseLoading}
                >
                  ดึงรายงาน
                </button>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
                <div>
                  Supplier:{" "}
                  {purchaseFilter.supplier_id
                    ? suppliers.find((s) => s.id === purchaseFilter.supplier_id)?.name || "-"
                    : "ทั้งหมด"}
                  {" | "}ช่วง: {purchaseFilter.start_date || "-"} ถึง {purchaseFilter.end_date || "-"}
                </div>
                <div className="font-semibold text-blue-700">
                  รวมทั้งสิ้น: {purchaseData.total_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })} บาท
                </div>
              </div>
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-200 px-3 py-2 w-10">ลำดับ</th>
                      <th className="border border-gray-200 px-3 py-2">เลขที่บิล</th>
                      <th className="border border-gray-200 px-3 py-2">Supplier</th>
                      <th className="border border-gray-200 px-3 py-2 w-28">วันที่</th>
                      <th className="border border-gray-200 px-3 py-2 w-32 text-right">ยอดรวม</th>
                      <th className="border border-gray-200 px-3 py-2">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          กำลังโหลด...
                        </td>
                      </tr>
                    ) : purchaseData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          <FileText className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    ) : (
                      purchaseData.rows.map((row, idx) => (
                        <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                          <td className="border border-gray-200 px-3 py-2 text-center">{idx + 1}</td>
                          <td className="border border-gray-200 px-3 py-2">{row.invoice_number}</td>
                          <td className="border border-gray-200 px-3 py-2">{row.supplier_name || "-"}</td>
                          <td className="border border-gray-200 px-3 py-2">{formatDate(row.purchase_date)}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-900">
                            {row.total_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="border border-gray-200 px-3 py-2">{row.notes || ""}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-center print:mt-10">
                <div className="border border-gray-400 rounded-md overflow-hidden min-w-[50%]">
                  <div className="grid grid-cols-2 text-center text-sm font-semibold">
                    <div className="border-r border-gray-400 px-4 py-3 text-pink-600">ยอดเงินรวม</div>
                    <div className="px-4 py-3 text-pink-600">
                      {purchaseData.total_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })} บาท
                    </div>
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
