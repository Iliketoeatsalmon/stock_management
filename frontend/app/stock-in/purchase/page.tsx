"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, API_URL } from "@/lib/api"
import { ArrowLeft, Plus, Trash2, Save, Upload, X } from "lucide-react"
import Link from "next/link"
import { DatePicker } from "@/components/ui/date-picker"

interface PurchaseItem {
  product_id: number
  product_name?: string
  quantity: number
  unit_price: number
}

export default function PurchasePage() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    invoice_number: "",
    supplier_id: 0,
    purchase_date: new Date().toISOString().split("T")[0],
    notes: "",
    attachment_url: "",
  })
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [attachments, setAttachments] = useState<{ file?: File; preview: string }[]>([])
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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [suppliersData, productsData] = await Promise.all([api.get("/api/suppliers"), api.get("/api/products")])
      setSuppliers(suppliersData)
      setProducts(productsData)
    } catch (err) {
      console.error("Failed to load data:", err)
    }
  }

  const addItem = () => {
    setItems([...items, { product_id: 0, quantity: 1, unit_price: 0 }])
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

    setLoading(true)
    setError("")

    try {
      let attachmentUrl = form.attachment_url
      if (attachments.length > 0) {
        const urls: string[] = []
        for (const att of attachments) {
          if (att.file) {
            const fd = new FormData()
            fd.append("file", att.file)
            const uploadRes = await api.upload("/api/upload-image", fd)
            urls.push(uploadRes.url.startsWith("http") ? uploadRes.url : `${API_URL}${uploadRes.url}`)
          }
        }
        attachmentUrl = JSON.stringify(urls)
      }

      await api.post("/api/purchases", { ...form, attachment_url: attachmentUrl, items })
      router.push("/dashboard")
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="บันทึกบิลซื้อเข้า" />

          <main className="flex-1 p-6">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
              <ArrowLeft className="w-4 h-4" />
              กลับ
            </Link>

            <form onSubmit={handleSubmit}>
              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

              {/* Header Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">ข้อมูลบิล</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">เลขที่บิล *</label>
                    <input
                      type="text"
                      value={form.invoice_number}
                      onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Supplier *</label>
                    <select
                      value={form.supplier_id}
                      onChange={(e) => setForm({ ...form, supplier_id: Number.parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value={0}>เลือก Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">วันที่ *</label>
                    <DatePicker value={form.purchase_date} onChange={(value) => setForm({ ...form, purchase_date: value })} />
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
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">แนบบิล/หลักฐาน (หลายรูปได้)</label>
              <div className="flex flex-wrap gap-3 items-center">
                {attachments.map((att, idx) => (
                  <div key={idx} className="relative">
                    <img src={att.preview} alt="attachment" className="w-24 h-24 rounded-lg object-cover border border-gray-300" />
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <label className="w-24 h-24 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center cursor-pointer">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        setAttachments((prev) => [...prev, { file: f, preview: URL.createObjectURL(f) }])
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
              </div>

              {/* Items */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">รายการสินค้า</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowProductModal(true)}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่มสินค้าใหม่
                    </button>
                    <button
                      type="button"
                      onClick={addItem}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่มรายการ
                    </button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">ยังไม่มีรายการสินค้า</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">สินค้า</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">ราคา/หน่วย</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">รวม</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {items.map((item, index) => (
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
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, "quantity", Number.parseInt(e.target.value) || 0)}
                              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-right"
                              min="1"
                              required
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, "unit_price", Number.parseFloat(e.target.value) || 0)}
                              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-right"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            {(item.quantity * item.unit_price).toLocaleString()}
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
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/dashboard" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  ยกเลิก
                </Link>
                <button
                  type="submit"
                  disabled={loading || items.length === 0}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {loading ? "กำลังบันทึก..." : "บันทึกบิลซื้อเข้า"}
                </button>
              </div>
            </form>
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
                  await api.post("/api/products", { ...productForm, image_url: imageUrl })
                  const productsData = await api.get("/api/products")
                  setProducts(productsData)
                  setShowProductModal(false)
                  setProductForm({ code: "", name: "", unit: "ชิ้น", min_stock: 0, description: "", image_url: "" })
                  setProductImageFile(null)
                  setProductImagePreview("")
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
