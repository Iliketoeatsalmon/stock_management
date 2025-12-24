"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, API_URL } from "@/lib/api"
import { Plus, Search, Edit, Eye, Package, X, Trash2 } from "lucide-react"
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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    unit: "",
    min_stock: 0,
    image_url: "",
  })
  const [editFile, setEditFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [search])

  const loadProducts = async () => {
    try {
      const endpoint = search ? `/products?search=${encodeURIComponent(search)}` : "/products"
      const result = await api.get(endpoint)
      setProducts(result)
    } catch (err) {
      console.error("Failed to load products:", err)
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setEditForm({
      name: product.name,
      description: product.description || "",
      unit: product.unit,
      min_stock: product.min_stock,
      image_url: product.image_url || "",
    })
    setPreview(getImageSrc(product.image_url))
    setEditFile(null)
  }

  const uploadImage = async (file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    const res = await api.upload("/upload-image", fd)
    return res.url.startsWith("http") ? res.url : res.url
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      let imageUrl = editForm.image_url
      if (editFile) {
        imageUrl = await uploadImage(editFile)
      }
      await api.put(`/products/${editing.id}`, {
        ...editForm,
        image_url: imageUrl,
      })
      setEditing(null)
      await loadProducts()
    } catch (err) {
      console.error("Failed to update product", err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (productId: number, name: string) => {
    if (!confirm(`ลบสินค้า ${name}?`)) return
    try {
      await api.delete(`/api/products/${productId}`)
      await loadProducts()
    } catch (err) {
      console.error("Failed to delete product", err)
    }
  }

  const getImageSrc = (imageUrl?: string) => {
    if (!imageUrl) return ""
    if (imageUrl.startsWith("http")) return imageUrl
    // If the stored URL already includes the API prefix ("/api/..."), use as-is.
    if (imageUrl.startsWith("/api")) return imageUrl
    // If the stored URL is a backend uploads path ("/uploads/.."), prefix with API base so nginx routes it to backend.
    if (imageUrl.startsWith("/uploads")) return `${API_URL}${imageUrl}`
    return `${API_URL}${imageUrl}`
  }

  return (
    <>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="สินค้า" />

          <main className="flex-1 p-6">
            {/* Actions */}
            <div className="flex items-center justify-between mb-6">
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาสินค้า..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-500 bg-white"
                />
              </div>
              <Link
                href="/products/new"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                เพิ่มสินค้า
              </Link>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">รูป</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รหัส</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อสินค้า</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">หน่วย</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">คงเหลือ</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ขั้นต่ำ</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>ไม่พบสินค้า</p>
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          {product.image_url ? (
                            <img
                              src={getImageSrc(product.image_url)}
                              alt={product.name}
                              className="w-12 h-12 rounded-lg object-cover border border-gray-200 bg-white"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-300" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{product.code}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{product.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{product.unit}</td>
                        <td className="px-6 py-4 text-sm text-right">
                          <span
                            className={`font-semibold ${product.current_stock <= product.min_stock ? "text-red-600" : "text-green-600"}`}
                          >
                            {product.current_stock}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-500">{product.min_stock}</td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${product.current_stock <= product.min_stock ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                          >
                            {product.current_stock <= product.min_stock ? "ใกล้หมด" : "ปกติ"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/products/${product.id}`}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => openEdit(product)}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                              type="button"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id, product.name)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              type="button"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-500">แก้ไขสินค้า</p>
                <h3 className="text-lg font-semibold text-gray-900">{editing.code}</h3>
              </div>
              <button onClick={() => setEditing(null)} className="p-2 text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อสินค้า</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">หน่วย</label>
                  <input
                    type="text"
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">จำนวนขั้นต่ำ</label>
                  <input
                    type="number"
                    value={editForm.min_stock}
                    onChange={(e) => setEditForm({ ...editForm, min_stock: Number.parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 bg-white"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">รายละเอียด</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 bg-white"
                    rows={2}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">รูปสินค้า</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden">
                    {preview ? <img src={preview} alt="preview" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-400">ไม่มีรูป</span>}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setEditFile(file)
                          setPreview(URL.createObjectURL(file))
                        }
                      }}
                      className="block w-full text-sm text-gray-700"
                    />
                    <p className="text-xs text-gray-500">JPG, PNG</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
