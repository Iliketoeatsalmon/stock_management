"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, API_URL, resolveUploadUrl } from "@/lib/api"
import { FileText, Printer, RefreshCcw, Filter } from "lucide-react"

interface StockRow {
  id: number
  code: string
  name: string
  unit: string
  min_stock: number
  current_stock: number
  image_url?: string
}

export default function StockReportPage() {
  const [stockFilter, setStockFilter] = useState<"all" | "available" | "low">("all")
  const [stockData, setStockData] = useState<StockRow[]>([])
  const [stockLoading, setStockLoading] = useState(true)

  useEffect(() => {
    loadStock()
  }, [stockFilter])

  const loadStock = async () => {
    setStockLoading(true)
    try {
      const result = await api.get(`/reports/stock?filter=${stockFilter}`)
      setStockData(result)
    } catch (err) {
      console.error("Failed to load stock report:", err)
    } finally {
      setStockLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50 print:bg-white">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="print:hidden">
          <Header title="รายงานสต๊อก" />
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
                <h3 className="text-lg font-semibold text-gray-900">รายงานสต๊อก</h3>
                <p className="text-sm text-gray-600">เลือกตัวกรองแล้วพิมพ์รายงาน</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button
                  onClick={loadStock}
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

            <div className="px-6 py-4 print:hidden">
              <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-gray-500" />
                <div className="flex gap-2">
                  {[
                    { value: "all", label: "ทั้งหมด" },
                    { value: "available", label: "มีของคงเหลือ" },
                    { value: "low", label: "ใกล้หมด" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStockFilter(opt.value as any)}
                      className={`px-3 py-1.5 text-sm rounded-lg border ${
                        stockFilter === opt.value
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="text-sm text-gray-600 mb-2">
                รายการ: {stockData.length.toLocaleString()} | ตัวกรอง:{" "}
                {stockFilter === "all" ? "ทั้งหมด" : stockFilter === "available" ? "มีของคงเหลือ" : "ใกล้หมด"}
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-200 px-3 py-2 w-10">ลำดับ</th>
                      <th className="border border-gray-200 px-3 py-2 w-20">รูป</th>
                      <th className="border border-gray-200 px-3 py-2">สินค้า</th>
                      <th className="border border-gray-200 px-3 py-2 text-right w-20">คงเหลือ</th>
                      <th className="border border-gray-200 px-3 py-2 text-right w-20">ขั้นต่ำ</th>
                      <th className="border border-gray-200 px-3 py-2 w-20">หน่วย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          กำลังโหลด...
                        </td>
                      </tr>
                    ) : stockData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          <FileText className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    ) : (
                      stockData.map((p, idx) => (
                        <tr key={p.id} className="odd:bg-white even:bg-gray-50">
                          <td className="border border-gray-200 px-3 py-2 text-center">{idx + 1}</td>
                          <td className="border border-gray-200 px-3 py-2">
                            {p.image_url ? (
                              <img
                                src={resolveUploadUrl(p.image_url || "")}
                                className="w-12 h-12 object-cover mx-auto"
                                alt={p.name}
                              />
                            ) : (
                              <div className="w-12 h-12 border border-dashed border-gray-300 bg-gray-50 mx-auto"></div>
                            )}
                          </td>
                          <td className="border border-gray-200 px-3 py-2">
                            <div className="font-medium text-gray-900">{p.name}</div>
                            <div className="text-xs text-gray-500">{p.code}</div>
                          </td>
                          <td
                            className={`border border-gray-200 px-3 py-2 text-right font-semibold ${
                              p.current_stock <= p.min_stock ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {p.current_stock}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-right text-gray-700">{p.min_stock}</td>
                          <td className="border border-gray-200 px-3 py-2 text-center text-gray-700">{p.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
