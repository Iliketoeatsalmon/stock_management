"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, API_URL, resolveUploadUrl } from "@/lib/api"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    unit: "ชิ้น",
    min_stock: 0,
    image_url: "",
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [uploading, setUploading] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      let imageUrl = form.image_url
      if (imageFile) {
        setUploading(true)
        const fd = new FormData()
        fd.append("file", imageFile)
        const uploadRes = await api.upload("/upload-image", fd)
        imageUrl = resolveUploadUrl(uploadRes.url)
      }

      await api.post("/products", { ...form, image_url: imageUrl })
      router.push("/products")
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด")
    } finally {
      setUploading(false)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="เพิ่มสินค้าใหม่" />

        <main className="flex-1 p-6">
          <div className="max-w-2xl">
            <Link href="/products" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
              <ArrowLeft className="w-4 h-4" />
              กลับ
            </Link>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">รหัสสินค้า *</label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 bg-white"
                    placeholder="CLN-001"
                    required
                  />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">หน่วยนับ *</label>
                    <input
                      type="text"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 bg-white"
                    placeholder="ชิ้น"
                    required
                  />
                </div>
              </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อสินค้า *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 bg-white"
                  placeholder="น้ำยาทำความสะอาด"
                  required
                />
              </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">รายละเอียด</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 bg-white"
                    rows={3}
                    placeholder="รายละเอียดสินค้า..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">จำนวนขั้นต่ำ (แจ้งเตือน)</label>
                  <input
                    type="number"
                    value={form.min_stock}
                    onChange={(e) => setForm({ ...form, min_stock: Number.parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 bg-white"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">รูปสินค้า</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden">
                      {imagePreview || form.image_url ? (
                        <img src={imagePreview || form.image_url} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">เลือกไฟล์</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="block w-full text-sm text-gray-700"
                      />
                      <p className="text-xs text-gray-500">รองรับภาพ JPG, PNG</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Link href="/products" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    ยกเลิก
                  </Link>
                  <button
                    type="submit"
                    disabled={loading || uploading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading || uploading ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
