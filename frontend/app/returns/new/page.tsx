"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, resolveUploadUrl } from "@/lib/api"
import { ArrowLeft, Plus, Save, Trash2, Upload, X } from "lucide-react"
import Link from "next/link"
import { DatePicker } from "@/components/ui/date-picker"
import { ProductSelect } from "@/components/ui/product-select"
import { QuantityInput } from "@/components/ui/quantity-input"
import { NumberInput } from "@/components/ui/number-input"
import { formatQty, formatStock, toBaseQuantity, unitOptions } from "@/lib/units"

interface ReturnItemForm {
  product_id: number
  /** จำนวนตามหน่วยที่ผู้ใช้เลือกกรอก */
  quantity: number
  /** หน่วยที่ผู้ใช้เลือกกรอก (ว่าง = ใช้หน่วยฐานของสินค้า) */
  input_unit: string
  note: string
}

export default function NewReturnPage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    customer_id: 0,
    site_name: "",
    return_date: new Date().toISOString().split("T")[0],
    notes: "",
  })
  const [items, setItems] = useState<ReturnItemForm[]>([{ product_id: 0, quantity: 1, input_unit: "", note: "" }])

  // เพิ่มสินค้าใหม่ได้เลยถ้าของที่คืนกลับมายังไม่มีในระบบ
  const [showProductModal, setShowProductModal] = useState(false)
  const [productTargetIndex, setProductTargetIndex] = useState(0)
  const [productForm, setProductForm] = useState({
    name: "",
    unit: "ชิ้น",
    min_stock: 0,
    description: "",
    image_url: "",
  })
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImagePreview, setProductImagePreview] = useState("")

  useEffect(() => {
    loadProducts()
    loadCustomers()
  }, [])

  const loadProducts = async () => {
    try {
      setProducts(await api.get("/products"))
    } catch (err) {
      console.error("Failed to load products:", err)
    }
  }

  const loadCustomers = async () => {
    try {
      setCustomers(await api.get("/customers"))
    } catch (err) {
      console.error("Failed to load customers:", err)
    }
  }

  const addItem = () => setItems([...items, { product_id: 0, quantity: 1, input_unit: "", note: "" }])

  const removeItem = (index: number) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ReturnItemForm, value: any) => {
    const next = [...items]
    next[index] = { ...next[index], [field]: value }
    setItems(next)
  }

  const openProductModal = (index: number) => {
    setProductTargetIndex(index)
    setShowProductModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const validItems = items.filter((i) => i.product_id > 0 && i.quantity > 0)
    if (validItems.length === 0) {
      setError("กรุณาเลือกสินค้าที่คืนอย่างน้อย 1 รายการ")
      return
    }
    if (!form.customer_id && !form.site_name.trim()) {
      setError("กรุณาเลือกหน่วยงาน หรือระบุชื่อไซต์ที่คืนของ")
      return
    }

    setLoading(true)
    try {
      await api.post("/returns", {
        customer_id: form.customer_id || null,
        site_name: form.site_name.trim() || null,
        return_date: form.return_date,
        notes: form.notes.trim() || null,
        // quantity ที่ส่งไปต้องเป็นหน่วยฐานของสินค้า ส่วนที่กรอกจริงเก็บใน input_*
        items: validItems.map((i) => {
          const product = products.find((p) => p.id === i.product_id)
          const unit = i.input_unit || unitOptions(product)[0]
          return {
            product_id: i.product_id,
            quantity: toBaseQuantity(Number(i.quantity), unit, product),
            note: i.note || null,
            input_quantity: Number(i.quantity),
            input_unit: unit,
          }
        }),
      })
      router.push("/returns")
    } catch (err: any) {
      setError(err.message || "บันทึกการคืนของไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  // นับเป็นจำนวนรายการ ไม่รวมเป็นจำนวนชิ้น เพราะแต่ละสินค้าคนละหน่วย (แกลลอน/ลิตร/ใบ) บวกกันไม่ได้
  const totalQty = items.filter((i) => i.product_id > 0 && Number(i.quantity) > 0).length

  return (
    <>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="บันทึกการคืนของ" />

          <main className="flex-1 p-4 sm:p-6">
            <div className="max-w-4xl">
              <Link href="/returns" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 text-sm">
                <ArrowLeft className="w-4 h-4" />
                กลับ
              </Link>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4">
                  <h2 className="text-base font-semibold text-gray-900">ข้อมูลการคืน</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">หน่วยงาน (ลูกค้า)</label>
                      <select
                        value={form.customer_id}
                        onChange={(e) => setForm({ ...form, customer_id: Number(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                      >
                        <option value={0}>ไม่ระบุ</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อไซต์/หน้างาน</label>
                      <input
                        type="text"
                        value={form.site_name}
                        onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder-slate-500"
                        placeholder="เช่น ไซต์ลาดพร้าว อาคาร A"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">วันที่คืน *</label>
                      <DatePicker
                        value={form.return_date}
                        onChange={(value) => setForm({ ...form, return_date: value })}
                        className="px-4 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ</label>
                      <input
                        type="text"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder-slate-500"
                        placeholder="เหตุผลที่คืน เช่น ของเหลือจากงาน"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">* ต้องระบุหน่วยงานหรือชื่อไซต์อย่างน้อยหนึ่งอย่าง</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">รายการที่คืนกลับมา</h2>
                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่มรายการ
                    </button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, index) => {
                      const product = products.find((p) => p.id === item.product_id)
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div className="sm:col-span-6">
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs text-gray-600">สินค้า</label>
                                <button
                                  type="button"
                                  onClick={() => openProductModal(index)}
                                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> เพิ่มสินค้าใหม่
                                </button>
                              </div>
                              <ProductSelect
                                products={products}
                                value={item.product_id}
                                onChange={(id) => updateItem(index, "product_id", id)}
                                showStock
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="block text-xs text-gray-600 mb-1">จำนวน</label>
                              <QuantityInput
                                value={item.quantity}
                                unit={item.input_unit || unitOptions(product)[0]}
                                product={product}
                                onChange={({ quantity, unit }) => {
                                  const next = [...items]
                                  next[index] = { ...next[index], quantity, input_unit: unit }
                                  setItems(next)
                                }}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs text-gray-600 mb-1">หมายเหตุ</label>
                              <input
                                type="text"
                                value={item.note}
                                onChange={(e) => updateItem(index, "note", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                                placeholder="เช่น สภาพดี"
                              />
                            </div>
                            <div className="sm:col-span-1 flex items-end">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                disabled={items.length === 1}
                                className="w-full sm:w-auto p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                                title="ลบรายการ"
                              >
                                <Trash2 className="w-4 h-4 mx-auto" />
                              </button>
                            </div>
                          </div>
                          {product && (
                            <p className="text-xs text-gray-500">
                              คงเหลือปัจจุบัน {formatStock(product.current_stock, product)} → หลังรับคืนจะเป็น{" "}
                              <span className="font-semibold text-green-700">
                                {formatStock(
                                  Number(product.current_stock || 0) +
                                    toBaseQuantity(
                                      Number(item.quantity) || 0,
                                      item.input_unit || unitOptions(product)[0],
                                      product,
                                    ),
                                  product,
                                )}
                              </span>
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-sm">
                    <span className="text-gray-600">รวมจำนวนรายการที่รับคืน</span>
                    <span className="font-semibold text-gray-900">{formatQty(totalQty)} รายการ</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Link href="/returns" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    ยกเลิก
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? "กำลังบันทึก..." : "บันทึกการคืน"}
                  </button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>

      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
                    const res = await api.upload("/upload-image", fd)
                    imageUrl = resolveUploadUrl(res.url)
                  }
                  const created = await api.post("/products", { ...productForm, image_url: imageUrl })
                  setProducts(await api.get("/products"))
                  updateItem(productTargetIndex, "product_id", created.id)
                  setShowProductModal(false)
                  setProductForm({ name: "", unit: "ชิ้น", min_stock: 0, description: "", image_url: "" })
                  setProductImageFile(null)
                  setProductImagePreview("")
                } catch (err: any) {
                  alert(err.message || "เพิ่มสินค้าไม่สำเร็จ")
                }
              }}
              className="space-y-3 text-sm"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">รหัสสินค้า</label>
                  <div className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    สร้างให้อัตโนมัติ
                  </div>
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
                <NumberInput
                  integer
                  min={0}
                  value={productForm.min_stock}
                  onValueChange={(v) => setProductForm({ ...productForm, min_stock: v })}
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
