"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { Package, AlertTriangle, Users, Building2, ArrowDownToLine, ArrowUpFromLine, Truck, Plus, AlertCircle, RefreshCw } from "lucide-react"
import Link from "next/link"

interface DashboardData {
  total_products: number
  low_stock_count: number
  low_stock_products: any[]
  recent_movements: any[]
  total_customers: number
  total_suppliers: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setError("")
    setLoading(true)
    try {
      const result = await api.get("/dashboard")
      setData(result)
    } catch (err) {
      setError("โหลดข้อมูลแดชบอร์ดไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="Dashboard" />
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-2">{error}</p>
              <button onClick={loadDashboard} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm mx-auto">
                <RefreshCw className="w-4 h-4" />ลองใหม่
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Dashboard" />
        <main className="flex-1 p-4 sm:p-6">

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <Link href="/stock-in/purchase" className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <ArrowDownToLine className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-green-900 text-sm">เพิ่มสินค้าเข้า (Supplier)</p>
                <p className="text-xs text-green-700">รับสินค้าจาก Supplier</p>
              </div>
            </Link>
            <Link href="/stock-in/manual" className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-blue-900 text-sm">เพิ่มสินค้าเข้า (บิลเงินสด)</p>
                <p className="text-xs text-blue-700">สินค้าทั่วไป</p>
              </div>
            </Link>
            <Link href="/deliveries/new" className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-purple-900 text-sm">สร้างใบส่งของ</p>
                <p className="text-xs text-purple-700">ส่งสินค้าให้ลูกค้า</p>
              </div>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "สินค้าทั้งหมด", value: data?.total_products ?? 0, icon: Package, color: "blue" },
              { label: "สินค้าใกล้หมด", value: data?.low_stock_count ?? 0, icon: AlertTriangle, color: "red" },
              { label: "ลูกค้า", value: data?.total_customers ?? 0, icon: Building2, color: "green" },
              { label: "Suppliers", value: data?.total_suppliers ?? 0, icon: Users, color: "orange" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color === "red" ? "text-red-600" : "text-gray-900"}`}>{stat.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${stat.color}-100`}>
                    <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Low Stock */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="font-semibold text-gray-900 text-sm">สินค้าใกล้หมด</h3>
              </div>
              <div className="p-4">
                {data?.low_stock_products && data.low_stock_products.length > 0 ? (
                  <div className="space-y-2">
                    {data.low_stock_products.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.code}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="font-bold text-red-600 text-sm">{p.current_stock} {p.unit}</p>
                          <p className="text-xs text-gray-400">Min: {p.min_stock}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-6">ไม่มีสินค้าใกล้หมด</p>
                )}
              </div>
            </div>

            {/* Recent movements */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">ประวัติล่าสุด</h3>
              </div>
              <div className="p-4">
                {data?.recent_movements && data.recent_movements.length > 0 ? (
                  <div className="space-y-2">
                    {data.recent_movements.slice(0, 6).map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          {m.movement_type === "IN" ? (
                            <ArrowDownToLine className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <ArrowUpFromLine className="w-4 h-4 text-red-600 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{m.product_name}</p>
                            <p className="text-xs text-gray-400">{m.reference_type}</p>
                          </div>
                        </div>
                        <p className={`font-bold text-sm flex-shrink-0 ml-2 ${m.movement_type === "IN" ? "text-green-600" : "text-red-600"}`}>
                          {m.movement_type === "IN" ? "+" : "-"}{m.quantity}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-6">ไม่มีประวัติ</p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
