"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { withBasePath } from "@/lib/base-path"
import { fetchCompanySettings, loadCompanySettings } from "@/lib/company"
import { ArrowLeft, CheckCircle, Printer, Trash2, Plus, Minus } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

export default function DeliveryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [delivery, setDelivery] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [editItems, setEditItems] = useState<any[]>([])
  const isDraft = delivery?.status === "draft"
  const [currentRole, setCurrentRole] = useState<string>("")

  useEffect(() => {
    loadDelivery()
    loadProducts()
  }, [params.id])

  const loadDelivery = async () => {
    try {
      const result = await api.get(`/api/deliveries/${params.id}`)
      setDelivery(result)
    } catch (err) {
      console.error("Failed to load delivery:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirm("ยืนยันการส่งสินค้า? สต๊อกจะถูกตัดอัตโนมัติ")) return

    setConfirming(true)
    try {
      await api.post(`/api/deliveries/${params.id}/confirm`, {})
      loadDelivery()
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด")
    } finally {
      setConfirming(false)
    }
  }

  const handlePrint = () => {
    window.open(withBasePath(`/deliveries/${params.id}/print`), "_blank")
  }

  const handleDelete = async () => {
    if (!confirm("ลบใบส่งของฉบับนี้? (ทำได้เฉพาะสถานะ Draft)")) return
    try {
      await api.delete(`/api/deliveries/${params.id}`)
      router.push("/deliveries")
    } catch (err: any) {
      alert(err.message || "ลบไม่สำเร็จ")
    }
  }

  const [companyInfo, setCompanyInfo] = useState(loadCompanySettings())

  useEffect(() => {
    let active = true
    fetchCompanySettings()
      .then((settings) => {
        if (active) setCompanyInfo(settings)
      })
      .catch(() => {})
    const stored = localStorage.getItem("user")
    if (stored) {
      try {
        setCurrentRole(JSON.parse(stored).role || "")
      } catch {}
    }
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (delivery?.items) {
      setEditItems(
        delivery.items.map((i: any) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          product_code: i.product_code,
          unit: i.unit,
          quantity: i.quantity,
          note: i.note || "",
        })),
      )
    }
  }, [delivery])

  const loadProducts = async () => {
    try {
      const res = await api.get("/products")
      setProducts(res)
    } catch (err) {
      console.error("load products failed", err)
    }
  }

  const updateItem = (idx: number, field: string, value: any) => {
    setEditItems((prev) => {
      const next = [...prev]
      const selectedProduct = field === "product_id" ? products.find((p) => p.id === value) : null
      next[idx] = {
        ...next[idx],
        [field]: value,
        ...(selectedProduct
          ? { product_name: selectedProduct.name, product_code: selectedProduct.code, unit: selectedProduct.unit }
          : {}),
      }
      return next
    })
  }

  const addItem = () => {
    setEditItems((prev) => [
      ...prev,
      { product_id: 0, quantity: 1, product_name: "", product_code: "", unit: "", note: "" },
    ])
  }

  const removeItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSaveEdit = async () => {
    if (!isDraft) return
    if (editItems.length === 0) {
      alert("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ")
      return
    }
    try {
      await api.put(`/api/deliveries/${params.id}`, {
        items: editItems.map((i) => ({
          product_id: i.product_id,
          quantity: Number(i.quantity) || 0,
          note: i.note || "",
        })),
      })
      await loadDelivery()
      alert("บันทึกการแก้ไขแล้ว")
    } catch (err: any) {
      alert(err.message || "บันทึกไม่สำเร็จ")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">ไม่พบใบส่งของ</p>
        </div>
      </div>
    )
  }

  const sortItemsByCode = (items: any[]) => {
    const list = [...items]
    const parseCode = (code: string) => {
      const matches = code?.match(/\d+/g)
      if (!matches) return null
      const num = Number(matches.join(""))
      return Number.isNaN(num) ? null : num
    }
    list.sort((a, b) => {
      const aNum = parseCode(a.product_code || "")
      const bNum = parseCode(b.product_code || "")
      if (aNum !== null && bNum !== null && aNum !== bNum) {
        return aNum - bNum
      }
      return String(a.product_code || "").localeCompare(String(b.product_code || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    })
    return list
  }

  const displayItems = isDraft ? editItems : sortItemsByCode(delivery.items || [])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <Header title="รายละเอียดใบส่งของ" />

        <main className="flex-1 p-4 sm:p-6 print:p-0">
          <style>{`
            @page { size: A4 portrait; margin: 4mm; }
            @media print {
              body { -webkit-print-color-adjust: exact; color-adjust: exact; }
              .print\\:hidden { display: none !important; }
              .print\\:block { display: block !important; }
              .page { box-shadow: none !important; border: none !important; }
              * { color: #000 !important; }
              /* Push the signature down on short documents (but still allow long tables to expand) */
              .print-area { font-size: 8px; line-height: 1; display: flex; flex-direction: column; min-height: 285mm !important; }
              .print-table { min-height: 0; flex: 1 1 auto; }
              .print-table th, .print-table td { padding: 1px !important; }
              .print-area .leading-relaxed { line-height: 1.2 !important; }
              .print-area .p-3 { padding: 4px !important; }
              .print-area .p-2 { padding: 3px !important; }
              .print-area .text-base { font-size: 10px !important; }
              .print-area .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 2px !important; }
              .signature-block { margin-top: auto !important; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              .signature-block { break-inside: avoid; page-break-inside: avoid; }
              .signature-block * { break-inside: avoid; page-break-inside: avoid; }
            }
          `}</style>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6 print:hidden">
            <Link href="/deliveries" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
              <ArrowLeft className="w-4 h-4" />
              กลับ
            </Link>
            <div className="flex gap-2 flex-wrap">
              {(delivery.status === "draft" || currentRole === "admin") && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบ
                </button>
              )}
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Printer className="w-4 h-4" />
                พิมพ์
              </button>
              {delivery.status === "draft" && (
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {confirming ? "กำลังยืนยัน..." : "ยืนยันส่งสินค้า"}
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 print:overflow-visible print:mx-0 print:px-0">
          <div className="page print-area bg-white rounded-xl border border-gray-200 p-4 sm:p-6 print:p-0 print:rounded-none print:border print:text-xs flex flex-col min-h-[270mm] min-w-[680px] print:min-w-0">
            {/* Header */}
            <div className="border border-gray-400">
              <div className="flex">
                <div className="w-1/3 border-r border-gray-400 flex items-center justify-center p-3">
                  <img src={companyInfo.logo} alt="logo" className="max-h-20 object-contain" />
                </div>
                <div className="w-2/3 p-3 text-sm print:text-xs leading-relaxed">
                  <div className="font-bold text-base">{companyInfo.nameEn}</div>
                  <div className="font-bold text-base text-gray-800">{companyInfo.nameTh}</div>
                  <div>{companyInfo.address}</div>
                  <div>{companyInfo.taxId}</div>
                  <div>{companyInfo.tel}</div>
                  <div>Email: {companyInfo.email}</div>
                  <div>{companyInfo.fax}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 border-t border-gray-400 text-sm print:text-xs">
                <div className="p-3 space-y-1 border-r border-gray-400">
                  <div><strong>Company:</strong> {delivery.customer_name || "-"}</div>
                  <div><strong>Delivery to:</strong> {delivery.customer_name || "-"}</div>
                  <div><strong>Address:</strong> {delivery.customer_address || "-"}</div>
                  <div><strong>Contact:</strong> {delivery.customer_contact_person || "-"}</div>
                  <div><strong>Tel:</strong> {delivery.customer_phone || "-"}</div>
                  <div><strong>Fax:</strong> -</div>
                </div>
                <div className="p-3 space-y-1">
                  <div><strong>Date:</strong> {format(new Date(delivery.delivery_date), "dd/MM/yyyy")}</div>
                  <div><strong>No:</strong> {delivery.delivery_number}</div>
                  <div>
                    <strong>ผู้ทำรายการ:</strong> {delivery.created_by_name || "-"}
                    {delivery.created_by_phone ? ` (${delivery.created_by_phone})` : ""}
                  </div>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] text-gray-500 border border-gray-300 rounded-full opacity-70 print:bg-white print:text-black print:border-gray-400">
                      {delivery.status === "confirmed"
                        ? "ยืนยันแล้ว"
                        : delivery.status === "cancelled"
                          ? "ยกเลิก"
                          : "Draft"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-gray-400 border-t-0 p-3 text-sm print:text-xs">
              <div className="text-xs text-gray-500 mb-1">หมายเหตุ</div>
              <div className="text-gray-900 whitespace-pre-wrap">{delivery.notes || "-"}</div>
            </div>

            {/* Items table */}
            <div className="print-table">
            <div className="border border-gray-400 border-b-0 px-3 py-2 font-semibold text-sm print:text-xs bg-gray-50 text-center">
              ใบส่งสินค้า
            </div>
            <table className="w-full border border-gray-400 text-sm print:text-xs mt-0">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-400 p-2 w-12">ลำดับ</th>
                  <th className="border border-gray-400 p-2 w-24">รหัสสินค้า</th>
                  <th className="border border-gray-400 p-2">รายการสินค้า</th>
                  <th className="border border-gray-400 p-2 w-16">จำนวน</th>
                  <th className="border border-gray-400 p-2 w-16">หน่วย</th>
                  <th className="border border-gray-400 p-2 w-24">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item: any, index: number) => (
                  <tr key={item.id || index}>
                    <td className="border border-gray-300 p-2 text-center align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <span>{index + 1}</span>
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 text-xs flex items-center gap-1"
                          >
                            <Minus className="w-3 h-3" /> ลบ
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-300 p-2 text-center align-middle">
                      {item.product_code || "-"}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      {isDraft ? (
                        <div className="space-y-1">
                          <select
                            value={item.product_id}
                            onChange={(e) => updateItem(index, "product_id", Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded-lg"
                          >
                            <option value={0}>เลือกสินค้า</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code} - {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-gray-900">{item.product_name}</div>
                        </div>
                      )}
                    </td>
                    <td className="border border-gray-300 p-2 text-center align-middle">
                      {isDraft ? (
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", Number(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center"
                        />
                      ) : (
                        item.quantity
                      )}
                    </td>
                    <td className="border border-gray-300 p-2 text-center align-middle">{item.unit}</td>
                    <td className="border border-gray-300 p-2 align-top">
                      {isDraft ? (
                        <div>
                          <label className="text-xs text-gray-500">หมายเหตุ</label>
                          <input
                            type="text"
                            value={item.note || ""}
                            onChange={(e) => updateItem(index, "note", e.target.value)}
                            className="mt-1 w-full px-2 py-1 border border-gray-300 rounded-lg text-sm"
                            placeholder="กรอกหมายเหตุ"
                          />
                        </div>
                      ) : (
                        item.note || ""
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="signature-block text-sm print:text-xs mt-0 print:mt-auto pt-4">
              <div className="grid grid-cols-2 text-center gap-2 print:gap-0">
                <div className="p-3 print:p-0">
                  ส่วนของลูกค้า/ผู้รับสินค้า<br />
                  <div className="mt-1 print:mt-0">..............................</div>
                  <div className="mt-1 print:mt-0">....../....../......</div>
                </div>
                <div className="p-3 print:p-0">
                  ส่วนของบริษัท/ผู้ส่งสินค้า<br />
                  <div className="mt-1 print:mt-0">..............................</div>
                  <div className="mt-1 print:mt-0">....../....../......</div>
                </div>
              </div>
            </div>

            {isDraft && (
              <div className="mt-4 flex flex-wrap justify-between items-center gap-2 print:hidden">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    เพิ่มสินค้า
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            )}
          </div>
          </div>
        </main>
      </div>
    </div>
  )
}
