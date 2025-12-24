"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { Plus, Building2 } from "lucide-react"

interface Customer {
  id: number
  name: string
  contact_person: string
  phone: string
  email?: string | null
  address: string
  tax_id?: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: "", contact_person: "", phone: "", email: "", address: "", tax_id: "" })
  const [editing, setEditing] = useState<Customer | null>(null)
  const [editForm, setEditForm] = useState({ name: "", contact_person: "", phone: "", email: "", address: "", tax_id: "" })

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const result = await api.get("/customers")
      setCustomers(result)
    } catch (err) {
      console.error("Failed to load customers:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post("/customers", form)
      setShowModal(false)
      setForm({ name: "", contact_person: "", phone: "", email: "", address: "", tax_id: "" })
      loadCustomers()
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err ? (err as any).message : String(err)
      alert(message || "เกิดข้อผิดพลาด")
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="ลูกค้า" />

        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">รายการลูกค้าทั้งหมด</p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              เพิ่มลูกค้า
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ติดต่อ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">โทรศัพท์</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ที่อยู่</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>ยังไม่มีลูกค้า</p>
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{customer.name}</td>
                      <td className="px-6 py-4 text-gray-600">{customer.contact_person || "-"}</td>
                      <td className="px-6 py-4 text-gray-600">{customer.phone || "-"}</td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{customer.address || "-"}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditing(customer)
                              setEditForm({
                                name: customer.name || "",
                                contact_person: customer.contact_person || "",
                                phone: customer.phone || "",
                                email: customer.email || "",
                                address: customer.address || "",
                                tax_id: customer.tax_id || "",
                              })
                            }}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            แก้ไข
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`ลบลูกค้า ${customer.name}?`)) return
                                      try {
                                            await api.delete(`/customers/${customer.id}`)
                                loadCustomers()
                              } catch (err) {
                                alert("ลบไม่สำเร็จ")
                              }
                            }}
                            className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                          >
                            ลบ
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">เพิ่มลูกค้า</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ติดต่อ</label>
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">โทรศัพท์</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลขผู้เสียภาษี (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={form.tax_id}
                  onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">แก้ไขลูกค้า</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  await api.put(`/customers/${editing.id}`, editForm)
                  setEditing(null)
                  loadCustomers()
                } catch (err) {
                  alert("บันทึกไม่สำเร็จ")
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ติดต่อ</label>
                <input
                  type="text"
                  value={editForm.contact_person}
                  onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">โทรศัพท์</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลขผู้เสียภาษี (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={editForm.tax_id}
                  onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
                <textarea
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder-slate-500"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
