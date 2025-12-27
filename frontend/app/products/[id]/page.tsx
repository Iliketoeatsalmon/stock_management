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
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                {data.product.image_url ? (
                  <img
                    src={resolveUploadUrl(data.product.image_url)}
                    alt={data.product.name}
                    className="w-28 h-28 rounded-lg border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                    ไม่มีรูป
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">{data.product.code}</p>
                  <h2 className="text-2xl font-bold text-gray-900">{data.product.name}</h2>
                  <p className="text-gray-600 mt-1">{data.product.description || "-"}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">คงเหลือ</p>
                <p
                  className={`text-4xl font-bold ${data.current_stock <= data.product.min_stock ? "text-red-600" : "text-green-600"}`}
                >
                  {data.current_stock}
                </p>
                <p className="text-gray-500">{data.product.unit}</p>
              </div>
            </div>
          </div>

          {/* Movements Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">ประวัติการเคลื่อนไหว (Stock Card)</h3>
            </div>
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
        </main>
      </div>
    </div>
  )
}
