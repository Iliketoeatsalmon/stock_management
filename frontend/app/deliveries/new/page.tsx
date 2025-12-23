"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react"
import Link from "next/link"
import { DatePicker } from "@/components/ui/date-picker"

interface DeliveryItem {
  product_id: number
  quantity: number
}

export default function NewDeliveryPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    customer_id: 0,
    delivery_date: new Date().toISOString().split("T")[0],
    notes: "",
  })
  const [items, setItems] = useState<DeliveryItem[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [customersData, productsData] = await Promise.all([api.get("/api/customers"), api.get("/api/products")])
      setCustomers(customersData)
      setProducts(productsData.map((p: any) => ({ ...p, id: Number(p.id) || p.id })))
    } catch (err) {
      console.error("Failed to load data:", err)
    }
  }

  const addItem = () => {
    setItems([...items, { product_id: 0, quantity: 1 }])
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      setError("กรุณาเพิ่มรายการสินค้า")
      return
    }

    if (items.some((i) => i.product_id === 0)) {
      setError("กรุณาเลือกสินค้าให้ครบทุกบรรทัด")
      return
    }

    setLoading(true)
    setError("")

    try {
      const payloadItems = items.map(({ product_id, quantity }) => ({ product_id, quantity }))
      const result = await api.post("/api/deliveries", { ...form, items: payloadItems })
      router.push(`/deliveries/${result.id}`)
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="สร้างใบส่งของ" />

        <main className="flex-1 p-6">
          <Link href="/deliveries" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-4 h-4" />
            กลับ
          </Link>

          <form onSubmit={handleSubmit}>
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">ข้อมูลใบส่งของ</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ลูกค้า *</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: Number.parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value={0}>เลือกลูกค้า</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">วันที่ส่ง *</label>
                  <DatePicker value={form.delivery_date} onChange={(value) => setForm({ ...form, delivery_date: value })} />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">รายการสินค้า</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  เพิ่มรายการ
                </button>
              </div>

              {items.length === 0 ? (
                <p className="text-gray-500 text-center py-8">ยังไม่มีรายการสินค้า</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">สินค้า</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">คงเหลือ</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">จำนวนส่ง</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, index) => {
                      const pid = Number(item.product_id)
                      const product = products.find((p) => Number(p.id) === pid)
                      return (
                        <tr key={index}>
                          <td className="px-4 py-2">
                            <select
                              value={item.product_id}
                              onChange={(e) => updateItem(index, "product_id", Number.parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              required
                            >
                              <option value={0}>เลือกสินค้า</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.code} - {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-right text-gray-500">
                            {product ? `${product.current_stock} ${product.unit}` : "-"}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, "quantity", Number.parseInt(e.target.value) || 0)}
                              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-right"
                              min="1"
                              max={product?.current_stock || 999}
                              required
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/deliveries" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                ยกเลิก
              </Link>
              <button
                type="submit"
                disabled={loading || items.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {loading ? "กำลังบันทึก..." : "บันทึก (Draft)"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  )
}
