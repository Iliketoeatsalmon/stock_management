"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api, resolveUploadUrl } from "@/lib/api"
import { Plus, Users, Shield, User } from "lucide-react"
import { fetchCompanySettings, loadCompanySettings, saveCompanySettings } from "@/lib/company"

interface UserData {
  id: number
  username: string
  email?: string | null
  phone?: string | null
  full_name: string
  role: string
  is_active: boolean
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    full_name: "",
    role: "staff",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [currentRole, setCurrentRole] = useState<string>("")
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [showCompany, setShowCompany] = useState(false)
  const [companyForm, setCompanyForm] = useState(loadCompanySettings())
  const [logoFile, setLogoFile] = useState<File | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("user")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setCurrentRole(parsed.role || "")
        setCurrentUserId(typeof parsed.id === "number" ? parsed.id : null)
      } catch {}
    }
    loadUsers()
  }, [])

  useEffect(() => {
    if (!showCompany) return
    let active = true
    fetchCompanySettings()
      .then((settings) => {
        if (!active) return
        setCompanyForm(settings)
        setLogoFile(null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [showCompany])

  const loadUsers = async () => {
    try {
      const result = await api.get("/users")
      setUsers(result)
    } catch (err) {
      console.error("Failed to load users:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (isEditing && editingUserId) {
        await api.put(`/users/${editingUserId}`, {
          email: form.email,
          phone: form.phone,
          full_name: form.full_name,
          role: form.role,
          password: form.password || undefined,
        })
      } else {
        await api.post("/users", form)
      }
      setShowModal(false)
      setForm({ username: "", email: "", phone: "", password: "", full_name: "", role: "staff" })
      setIsEditing(false)
      setEditingUserId(null)
      loadUsers()
    } catch (err) {
      alert("เพิ่มผู้ใช้งานไม่สำเร็จ")
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="ผู้ใช้งาน" />

        <main className="flex-1 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">จัดการผู้ใช้งานในระบบ</p>
            {currentRole === "admin" && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCompany(true)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  ตั้งค่าบริษัท
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setEditingUserId(null)
                    setForm({ username: "", email: "", phone: "", password: "", full_name: "", role: "staff" })
                    setShowModal(true)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-5 h-5" />
                  เพิ่มผู้ใช้
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>ยังไม่มีผู้ใช้งานในระบบ</p>
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        user.role === "admin" ? "bg-purple-100" : "bg-blue-100"
                      }`}
                    >
                      {user.role === "admin" ? (
                        <Shield className="w-6 h-6 text-purple-600" />
                      ) : (
                        <User className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-sm text-gray-500">
                        @{user.username} - {user.email || "-"} - {user.phone || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {user.role}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs ${
                        user.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                    {currentRole === "admin" && (
                      <button
                        onClick={() => {
                          setIsEditing(true)
                          setEditingUserId(user.id)
                          setForm({
                            username: user.username,
                            email: user.email || "",
                            phone: user.phone || "",
                            password: "",
                            full_name: user.full_name,
                            role: user.role,
                          })
                          setShowModal(true)
                        }}
                        className="px-3 py-1 text-xs rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    )}
                    {currentRole === "admin" && (
                      <button
                        onClick={async () => {
                          const nextStatus = !user.is_active
                          const actionLabel = nextStatus ? "เปิดใช้งาน" : "ปิดใช้งาน"
                          if (!confirm(`${actionLabel} ผู้ใช้ ${user.username}?`)) return
                          try {
                            await api.put(`/users/${user.id}/status`, { is_active: nextStatus })
                            loadUsers()
                          } catch (err) {
                            alert("อัปเดตสถานะผู้ใช้ไม่สำเร็จ")
                          }
                        }}
                        disabled={user.id === currentUserId && user.is_active}
                        className={`px-3 py-1 text-xs rounded-lg border ${
                          user.is_active
                            ? "text-red-600 border-red-200 hover:bg-red-50"
                            : "text-green-700 border-green-200 hover:bg-green-50"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {user.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {showModal && currentRole === "admin" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">เพิ่มผู้ใช้งาน</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้ *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-900 placeholder-slate-500 bg-white"
                  required={!isEditing}
                  disabled={isEditing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-900 placeholder-slate-500 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล (ไม่บังคับ)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-900 placeholder-slate-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-900 placeholder-slate-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isEditing ? "New Password (optional)" : "Password *"}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-900 placeholder-slate-500 bg-white"
                  required={!isEditing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">บทบาท</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-900 bg-white"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setIsEditing(false)
                    setEditingUserId(null)
                  }}
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

      {showCompany && currentRole === "admin" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">ตั้งค่าบริษัท</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const run = async () => {
                  let logoUrl = companyForm.logo
                  if (logoFile) {
                    const fd = new FormData()
                    fd.append("file", logoFile)
                    const res = await api.upload("/upload-image", fd)
                    logoUrl = resolveUploadUrl(res.url)
                  }
                  const updatedSettings = { ...companyForm, logo: logoUrl }
                  await api.put("/company-settings", updatedSettings)
                  saveCompanySettings(updatedSettings)
                  setCompanyForm(updatedSettings)
                  setShowCompany(false)
                  alert("บันทึกการตั้งค่าบริษัทสำเร็จ")
                }
                run().catch(() => alert("บันทึกการตั้งค่าบริษัทไม่สำเร็จ"))
              }}
              className="space-y-3 text-sm"
            >
              <div>
                <label className="block text-gray-700 mb-1">ชื่อบริษัท (TH)</label>
                <input
                  value={companyForm.nameTh}
                  onChange={(e) => setCompanyForm({ ...companyForm, nameTh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">ชื่อบริษัท (EN)</label>
                <input
                  value={companyForm.nameEn}
                  onChange={(e) => setCompanyForm({ ...companyForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">ที่อยู่</label>
                <textarea
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">Tax ID</label>
                  <input
                    value={companyForm.taxId}
                    onChange={(e) => setCompanyForm({ ...companyForm, taxId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">โทรศัพท์</label>
                  <input
                    value={companyForm.tel}
                    onChange={(e) => setCompanyForm({ ...companyForm, tel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">แฟกซ์</label>
                  <input
                    value={companyForm.fax}
                    onChange={(e) => setCompanyForm({ ...companyForm, fax: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">Email</label>
                  <input
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-gray-700 mb-1">โลโก้บริษัท (ถ้ามี)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        setLogoFile(f || null)
                      }}
                      className="text-sm"
                    />
                    {(companyForm.logo || logoFile) && (
                      <img
                        src={logoFile ? URL.createObjectURL(logoFile) : companyForm.logo}
                        alt="logo"
                        className="w-14 h-14 object-contain border border-gray-200 rounded"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ไม่อัปโหลดจะใช้ไฟล์เดิม (ค่าปัจจุบัน: {companyForm.logo || "-"})
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCompany(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
