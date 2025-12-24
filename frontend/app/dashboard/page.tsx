"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { Package, AlertTriangle, Users, Building2, ArrowDownToLine, ArrowUpFromLine, Truck, Plus } from "lucide-react"
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

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const result = await api.get("/dashboard")
      setData(result)
    } catch (err) {
      console.error("Failed to load dashboard:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Dashboard" />

        <main className="flex-1 p-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Link
              href="/stock-in/purchase"
              className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
            >
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                <ArrowDownToLine className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-green-900">เพิ่มสินค้าเข้า(Supplier)</p>
                <p className="text-sm text-green-700">รับสินค้าจาก Supplier</p>
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
                <p className="font-semibold text-blue-900">เพิ่มสินค้าเข้า(บิลเงินสด)</p>
                <p className="text-sm text-blue-700">สินค้าทั่วไป</p>
              </div>
            </Link>

            <Link
              href="/deliveries/new"
              className="flex items-center gap-4 p-4 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
            >
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-purple-900">สร้างใบส่งของ</p>
                <p className="text-sm text-purple-700">ส่งสินค้าให้ลูกค้า</p>
              </div>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">สินค้าทั้งหมด</p>
                  <p className="text-3xl font-bold text-gray-900">{data?.total_products || 0}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">สินค้าใกล้หมด</p>
                  <p className="text-3xl font-bold text-red-600">{data?.low_stock_count || 0}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">ลูกค้า</p>
                  <p className="text-3xl font-bold text-gray-900">{data?.total_customers || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Suppliers</p>
                  <p className="text-3xl font-bold text-gray-900">{data?.total_suppliers || 0}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Alert */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  สินค้าใกล้หมด
                </h3>
              </div>
              <div className="p-4">
                {data?.low_stock_products && data.low_stock_products.length > 0 ? (
                  <div className="space-y-3">
                    {data.low_stock_products.map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-500">{product.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">
                            {product.current_stock} {product.unit}
                          </p>
                          <p className="text-xs text-gray-500">Min: {product.min_stock}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">ไม่มีสินค้าใกล้หมด</p>
                )}
              </div>
            </div>

            {/* Recent Movements */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">ประวัติล่าสุด</h3>
              </div>
              <div className="p-4">
                {data?.recent_movements && data.recent_movements.length > 0 ? (
                  <div className="space-y-3">
                    {data.recent_movements.slice(0, 5).map((movement) => (
                      <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {movement.movement_type === "IN" ? (
                            <ArrowDownToLine className="w-5 h-5 text-green-600" />
                          ) : (
                            <ArrowUpFromLine className="w-5 h-5 text-red-600" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{movement.product_name}</p>
                            <p className="text-xs text-gray-500">{movement.reference_type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-bold ${movement.movement_type === "IN" ? "text-green-600" : "text-red-600"}`}
                          >
                            {movement.movement_type === "IN" ? "+" : "-"}
                            {movement.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">ไม่มีประวัติ</p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
