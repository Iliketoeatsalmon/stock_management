"use client"

import { useEffect, useState, useCallback } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, API_URL } from "@/lib/api"
import { Plus, Search, Edit, Eye, Package, X, Trash2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

interface Product {
  id: number
  code: string
  name: string
  unit: string
  min_stock: number
  current_stock: number
  is_active: boolean
  description?: string
  image_url?: string
}

const PAGE_SIZE = 20

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [sortOrder, setSortOrder] = useState<"none" | "code-asc" | "code-desc">("none")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState({ name: "", description: "", unit: "", min_stock: 0, image_url: "" })
  const [editFile, setEditFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)

  // Debounced search
  useEffect(() => {
    setPage(1)
    const timer = setTimeout(() => loadProducts(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadProducts = async (q: string) => {
    setError("")
    try {
      const endpoint = q ? `/products?search=${encodeURIComponent(q)}` : "/products"
      const result = await api.get(endpoint)
      setProducts(result)
    } catch (err) {
      setError("โหลดข้อมูลสินค้าไม่ได้ กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  const sortedProducts = (() => {
    const list = [...products]
    if (sortOrder === "none") return list
    const factor = sortOrder === "code-asc" ? 1 : -1
    const parseCode = (code: string) => {
      const matches = code.match(/\d+/g)
      if (!matches) return null
      const num = Number(matches.join(""))
      return Number.isNaN(num) ? null : num
    }
    list.sort((a, b) => {
      const aNum = parseCode(a.code)
      const bNum = parseCode(b.code)
      if (aNum !== null && bNum !== null && aNum !== bNum) return (aNum - bNum) * factor
      return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" }) * factor
    })
    return list
  })()

  const totalPages = Math.ceil(sortedProducts.length / PAGE_SIZE)
  const paged = sortedProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openEdit = (product: Product) => {
    setEditing(product)
    setEditForm({ name: product.name, description: product.description || "", unit: product.unit, min_stock: product.min_stock, image_url: product.image_url || "" })
    setPreview(getImageSrc(product.image_url))
    setEditFile(null)
  }

  const uploadImage = async (file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    const res = await api.upload("/upload-image", fd)
    return res.url
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      let imageUrl = editForm.image_url
      if (editFile) imageUrl = await uploadImage(editFile)
      await api.put(`/products/${editing.id}`, { ...editForm, image_url: imageUrl })
      setEditing(null)
      await loadProducts(search)
    } catch (err) {
      console.error("Failed to update product", err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (productId: number, name: string) => {
    if (!confirm(`ลบสินค้า "${name}"?`)) return
    try {
      await api.delete(`/products/${productId}`)
      await loadProducts(search)
    } catch (err) {
      setError("ลบสินค้าไม่ได้")
    }
  }

  const getImageSrc = (imageUrl?: string) => {
    if (!imageUrl) return ""
    if (imageUrl.startsWith("http")) return imageUrl
    if (imageUrl.startsWith("/api")) return imageUrl
    if (imageUrl.startsWith("/uploads")) return `${API_URL}${imageUrl}`
    return `${API_URL}${imageUrl}`
  }

  return (
    <>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="สินค้า" />
          <main className="flex-1 p-4 sm:p-6">

            {error && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาสินค้า..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400 bg-white text-sm"
                  />
                </div>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "none" | "code-asc" | "code-desc")}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 flex-shrink-0"
                >
                  <option value="none">เรียงรหัส</option>
                  <option value="code-asc">น้อย→มาก</option>
                  <option value="code-desc">มาก→น้อย</option>
                </select>
              </div>
              <Link
                href="/products/new"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                เพิ่มสินค้า
              </Link>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">รูป</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">รหัส</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อสินค้า</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">หน่วย</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">คงเหลือ</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ขั้นต่ำ</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={8} className="py-12 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></td></tr>
                  ) : paged.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-gray-500"><Package className="w-12 h-12 mx-auto mb-2 text-gray-300" /><p>ไม่พบสินค้า</p></td></tr>
                  ) : paged.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {product.image_url ? (
                          <img src={getImageSrc(product.image_url)} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200" loading="lazy" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                            <Package className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{product.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{product.unit}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-semibold ${product.current_stock <= product.min_stock ? "text-red-600" : "text-green-600"}`}>
                          {product.current_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">{product.min_stock}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${product.current_stock <= product.min_stock ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {product.current_stock <= product.min_stock ? "ใกล้หมด" : "ปกติ"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/products/${product.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4" /></Link>
                          <button onClick={() => openEdit(product)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" type="button"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(product.id, product.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" type="button"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-3">
              {loading ? (
                <div className="py-12 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
              ) : paged.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" /><p>ไม่พบสินค้า</p>
                </div>
              ) : paged.map((product) => (
                <div key={product.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex gap-3">
                    {product.image_url ? (
                      <img src={getImageSrc(product.image_url)} alt={product.name} className="w-14 h-14 rounded-lg object-cover border border-gray-200 flex-shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-gray-400">{product.code}</p>
                          <p className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${product.current_stock <= product.min_stock ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {product.current_stock <= product.min_stock ? "ใกล้หมด" : "ปกติ"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className={`font-bold ${product.current_stock <= product.min_stock ? "text-red-600" : "text-green-600"}`}>
                          คงเหลือ {product.current_stock} {product.unit}
                        </span>
                        <span className="text-gray-400">ขั้นต่ำ {product.min_stock}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                    <Link href={`/products/${product.id}`} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Eye className="w-3.5 h-3.5" /> ดู
                    </Link>
                    <button onClick={() => openEdit(product)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg" type="button">
                      <Edit className="w-3.5 h-3.5" /> แก้ไข
                    </button>
                    <button onClick={() => handleDelete(product.id, product.name)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" type="button">
                      <Trash2 className="w-3.5 h-3.5" /> ลบ
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">{sortedProducts.length} รายการ • หน้า {page}/{totalPages}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm ${p === page ? "bg-blue-600 text-white" : "border border-gray-200 hover:bg-gray-50 text-gray-700"}`}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <p className="text-xs text-gray-500">แก้ไขสินค้า</p>
                <h3 className="text-base font-semibold text-gray-900">{editing.code}</h3>
              </div>
              <button onClick={() => setEditing(null)} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อสินค้า</label>
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">หน่วย</label>
                  <input type="text" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">จำนวนขั้นต่ำ</label>
                  <input type="number" value={editForm.min_stock} onChange={(e) => setEditForm({ ...editForm, min_stock: Number.parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-sm" min={0} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">รายละเอียด</label>
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-sm" rows={2} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">รูปสินค้า</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {preview ? <img src={preview} alt="preview" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-400">ไม่มีรูป</span>}
                  </div>
                  <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setEditFile(f); setPreview(URL.createObjectURL(f)) } }} className="block text-sm text-gray-600" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">ยกเลิก</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
