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
      const [customersData, productsData] = await Promise.all([api.get("/customers"), api.get("/products")])
      setCustomers(customersData)
      setProducts(productsData.map((p: any) => ({ ...p, id: Number(p.id) || p.id })))
    } catch (err) {
      console.error("Failed to load data:", err)
    }
  }

  const addItem = () => setItems([...items, { product_id: 0, quantity: 1 }])

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) { setError("กรุณาเพิ่มรายการสินค้า"); return }
    if (items.some((i) => i.product_id === 0)) { setError("กรุณาเลือกสินค้าให้ครบทุกบรรทัด"); return }
    setLoading(true)
    setError("")
    try {
      const result = await api.post("/deliveries", { ...form, items: items.map(({ product_id, quantity }) => ({ product_id, quantity })) })
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
        <main className="flex-1 p-4 sm:p-6">
          <Link href="/deliveries" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-5">
            <ArrowLeft className="w-4 h-4" />กลับ
          </Link>

          <form onSubmit={handleSubmit}>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}

            {/* Header info */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="font-semibold text-gray-900 mb-4 text-sm">ข้อมูลใบส่งของ</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ลูกค้า *</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: Number.parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                    required
                  >
                    <option value={0}>เลือกลูกค้า</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">วันที่ส่ง *</label>
                  <DatePicker value={form.delivery_date} onChange={(v) => setForm({ ...form, delivery_date: v })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">หมายเหตุ</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 text-sm">รายการสินค้า</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  <Plus className="w-4 h-4" />เพิ่มรายการ
                </button>
              </div>

              {items.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">ยังไม่มีรายการ — กด "เพิ่มรายการ"</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const pid = Number(item.product_id)
                    const product = products.find((p) => Number(p.id) === pid)
                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        {/* Mobile: stacked layout */}
                        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">สินค้า</label>
                            <select
                              value={item.product_id}
                              onChange={(e) => updateItem(index, "product_id", Number.parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                              required
                            >
                              <option value={0}>เลือกสินค้า</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-end gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">
                                คงเหลือ
                                {product && <span className="ml-1 font-semibold text-blue-600">{product.current_stock} {product.unit}</span>}
                              </label>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, "quantity", Number.parseInt(e.target.value) || 0)}
                                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-right text-sm bg-white"
                                placeholder="จำนวน"
                                min="1"
                                max={product?.current_stock || 999}
                                required
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg mb-0.5"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Stock warning */}
                        {product && item.quantity > product.current_stock && (
                          <p className="text-xs text-red-500 mt-2">⚠ จำนวนเกินสต๊อกที่มี ({product.current_stock} {product.unit})</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Link href="/deliveries" className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-center">ยกเลิก</Link>
              <button
                type="submit"
                disabled={loading || items.length === 0}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
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
