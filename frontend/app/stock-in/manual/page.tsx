"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, API_URL } from "@/lib/api"
import { ArrowLeft, Save, Plus, Upload, X } from "lucide-react"
import Link from "next/link"

export default function ManualStockInPage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showProductModal, setShowProductModal] = useState(false)
  const [productForm, setProductForm] = useState({
    code: "",
    name: "",
    unit: "ชิ้น",
    min_stock: 0,
    description: "",
    image_url: "",
  })
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImagePreview, setProductImagePreview] = useState("")

  const [form, setForm] = useState({
    product_id: 0,
    quantity: 1,
    notes: "",
  })

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const data = await api.get("/api/products")
      setProducts(data)
    } catch (err) {
      console.error("Failed to load products:", err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      await api.post("/api/stock/manual-in", form)
      setSuccess("เพิ่มสต๊อกสำเร็จ")
      setForm({ product_id: 0, quantity: 1, notes: "" })
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  const selectedProduct = products.find((p) => p.id === form.product_id)

  return (
    <>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="เพิ่มสต๊อก Manual" />

          <main className="flex-1 p-6">
            <div className="max-w-xl">
              <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
                <ArrowLeft className="w-4 h-4" />
                กลับ
              </Link>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
                  {success && <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm">{success}</div>}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">เลือกสินค้า *</label>
                      <button
                        type="button"
                        onClick={() => setShowProductModal(true)}
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> เพิ่มสินค้าใหม่
                      </button>
                    </div>
                    <select
                      value={form.product_id}
                      onChange={(e) => setForm({ ...form, product_id: Number.parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value={0}>เลือกสินค้า</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProduct && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">คงเหลือปัจจุบัน</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {selectedProduct.current_stock} {selectedProduct.unit}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">จำนวนที่เพิ่ม *</label>
                    <input
                      type="number"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: Number.parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="เช่น รับของฟรี, ปรับยอด..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || form.product_id === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? "กำลังบันทึก..." : "เพิ่มสต๊อก"}
                  </button>
                </form>
              </div>
            </div>
          </main>
        </div>
      </div>

      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">เพิ่มสินค้าใหม่</h3>
              <button onClick={() => setShowProductModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  let imageUrl = productForm.image_url
                  if (productImageFile) {
                    const fd = new FormData()
                    fd.append("file", productImageFile)
                    const res = await api.upload("/api/upload-image", fd)
                    imageUrl = res.url.startsWith("http") ? res.url : `${API_URL}${res.url}`
                  }
                  const created = await api.post("/api/products", { ...productForm, image_url: imageUrl })
                  const productsData = await api.get("/api/products")
                  setProducts(productsData)
                  setForm((prev) => ({ ...prev, product_id: created.id }))
                  setShowProductModal(false)
                  setProductForm({ code: "", name: "", unit: "ชิ้น", min_stock: 0, description: "", image_url: "" })
                  setProductImageFile(null)
                  setProductImagePreview("")
                  setSuccess("เพิ่มสินค้าใหม่แล้ว")
                } catch (err) {
                  alert("เพิ่มสินค้าไม่สำเร็จ")
                }
              }}
              className="space-y-3 text-sm"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">รหัสสินค้า *</label>
                  <input
                    value={productForm.code}
                    onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">หน่วย *</label>
                  <input
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">ชื่อสินค้า *</label>
                <input
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">รายละเอียด</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">ขั้นต่ำ (เตือน)</label>
                <input
                  type="number"
                  min={0}
                  value={productForm.min_stock}
                  onChange={(e) => setProductForm({ ...productForm, min_stock: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">รูปสินค้า (ไม่บังคับ)</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 border border-dashed border-gray-300 bg-gray-50 rounded flex items-center justify-center overflow-hidden">
                    {productImagePreview || productForm.image_url ? (
                      <img src={productImagePreview || productForm.image_url} alt="product" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        setProductImageFile(f || null)
                        setProductImagePreview(f ? URL.createObjectURL(f) : "")
                      }}
                      className="text-sm"
                    />
                    <p className="text-xs text-gray-500">JPG, PNG</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  บันทึกสินค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
