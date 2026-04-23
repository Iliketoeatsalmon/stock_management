"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, resolveUploadUrl } from "@/lib/api"
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface StockCardData {
  product: any
  movements: any[]
  current_stock: number
}

export default function ProductDetailPage() {
  const params = useParams()
  const [data, setData] = useState<StockCardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStockCard()
  }, [params.id])

  const loadStockCard = async () => {
    try {
      const result = await api.get(`/api/stock-card/${params.id}`)
      setData(result)
    } catch (err) {
      console.error("Failed to load stock card:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">ไม่พบข้อมูลสินค้า</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Stock Card" />

        <main className="flex-1 p-4 sm:p-6">
          <Link href="/products" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-4 h-4" />
            กลับ
          </Link>

          {/* Product Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                {data.product.image_url ? (
                  <img
                    src={resolveUploadUrl(data.product.image_url)}
                    alt={data.product.name}
                    className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg border border-gray-200 object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                    ไม่มีรูป
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">{data.product.code}</p>
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900">{data.product.name}</h2>
                  <p className="text-sm text-gray-600 mt-1">{data.product.description || "-"}</p>
                </div>
              </div>
              <div className="text-left sm:text-right flex sm:block items-baseline gap-2 self-stretch sm:self-auto border-t sm:border-0 border-gray-100 pt-3 sm:pt-0 w-full sm:w-auto">
                <p className="text-xs sm:text-sm text-gray-500">คงเหลือ</p>
                <p
                  className={`text-2xl sm:text-4xl font-bold ${data.current_stock <= data.product.min_stock ? "text-red-600" : "text-green-600"}`}
                >
                  {data.current_stock}
                </p>
                <p className="text-sm text-gray-500">{data.product.unit}</p>
              </div>
            </div>
          </div>

          {/* Movements Table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">ประวัติการเคลื่อนไหว (Stock Card)</h3>
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภท</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อ้างอิง</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">เข้า</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ออก</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">คงเหลือ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ทำรายการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        ไม่มีประวัติการเคลื่อนไหว
                      </td>
                    </tr>
                  ) : (
                    data.movements.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              m.movement_type === "IN" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {m.movement_type === "IN" ? (
                              <ArrowDownToLine className="w-3 h-3" />
                            ) : (
                              <ArrowUpFromLine className="w-3 h-3" />
                            )}
                            {m.movement_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{m.reference_type || "-"}</td>
                        <td className="px-6 py-4 text-sm text-right text-green-600 font-medium">
                          {m.movement_type === "IN" ? `+${m.quantity}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-red-600 font-medium">
                          {m.movement_type === "OUT" ? `-${m.quantity}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{m.balance}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{m.user_name || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {data.movements.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500 text-sm">ไม่มีประวัติการเคลื่อนไหว</div>
              ) : (
                data.movements.map((m) => (
                  <div key={m.id} className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.movement_type === "IN" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {m.movement_type === "IN" ? (
                          <ArrowDownToLine className="w-3 h-3" />
                        ) : (
                          <ArrowUpFromLine className="w-3 h-3" />
                        )}
                        {m.movement_type}
                      </span>
                      <span className={`font-bold text-sm ${m.movement_type === "IN" ? "text-green-600" : "text-red-600"}`}>
                        {m.movement_type === "IN" ? "+" : "-"}{m.quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}</span>
                      <span>คงเหลือ <span className="font-bold text-gray-900">{m.balance}</span></span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                      <span>{m.reference_type || "-"}</span>
                      <span>{m.user_name || "-"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
