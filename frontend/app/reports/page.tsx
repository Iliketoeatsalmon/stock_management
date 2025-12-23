"use client"

import Link from "next/link"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { FileText, ShoppingBag } from "lucide-react"

export default function ReportsHome() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="รายงาน" />
        <main className="flex-1 p-6">
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
            <Link
              href="/reports/stock"
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all group"
            >
              <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                <FileText className="w-7 h-7 text-blue-600 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">รายงานสต๊อก</h3>
              <p className="text-sm text-gray-600 mt-1">ดูคงเหลือ/สินค้าใกล้หมด และพิมพ์รายงาน</p>
            </Link>

            <Link
              href="/reports/purchases"
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all group"
            >
              <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center mb-4 group-hover:bg-green-600 transition-colors">
                <ShoppingBag className="w-7 h-7 text-green-600 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">รายงานการซื้อ</h3>
              <p className="text-sm text-gray-600 mt-1">เลือก Supplier/ช่วงเวลา พร้อมยอดรวม และพิมพ์รายงาน</p>
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
}
