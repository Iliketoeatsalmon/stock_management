"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { Plus, Eye, Truck } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface Delivery {
  id: number
  delivery_number: string
  customer_name: string
  delivery_date: string
  status: string
  created_at: string
  created_by_name?: string
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDeliveries()
  }, [])

  const loadDeliveries = async () => {
    try {
      const result = await api.get("/deliveries")
      setDeliveries(result)
    } catch (err) {
      console.error("Failed to load deliveries:", err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">Draft</span>
      case "confirmed":
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">ยืนยันแล้ว</span>
      case "cancelled":
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">ยกเลิก</span>
      default:
        return null
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="ใบส่งของ" />

        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">รายการใบส่งของทั้งหมด</p>
            <Link
              href="/deliveries/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              สร้างใบส่งของ
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขที่ใบส่งของ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลูกค้า</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ทำรายการ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่ส่ง</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    </td>
                  </tr>
                ) : deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <Truck className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>ยังไม่มีใบส่งของ</p>
                    </td>
                  </tr>
                ) : (
                  deliveries.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{delivery.delivery_number}</td>
                      <td className="px-6 py-4 text-gray-600">{delivery.customer_name}</td>
                      <td className="px-6 py-4 text-gray-600">{delivery.created_by_name || "-"}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {format(new Date(delivery.delivery_date), "dd/MM/yyyy")}
                      </td>
                      <td className="px-6 py-4 text-center">{getStatusBadge(delivery.status)}</td>
                      <td className="px-6 py-4 text-center">
                        <Link
                          href={`/deliveries/${delivery.id}`}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg inline-flex"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
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
