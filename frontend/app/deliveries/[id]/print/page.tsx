"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { API_URL } from "@/lib/api"
import { PdfPages } from "@/components/ui/pdf-pages"

const PRICE_TYPES = [
  { value: "wholesale", label: "ราคาส่ง" },
  { value: "retail", label: "ราคาปลีก" },
  { value: "cost", label: "ราคาทุน" },
]

export default function DeliveryPrintPage() {
  const params = useParams()
  const [pdfUrl, setPdfUrl] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [deliveryNumber, setDeliveryNumber] = useState<string>("")
  const [showImage, setShowImage] = useState(true)
  const [showPrice, setShowPrice] = useState(false)
  const [priceType, setPriceType] = useState("wholesale")
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768)
  }, [])

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id
    if (!id) return
    let active = true
    let objectUrl: string | null = null

    const loadPdf = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const query = new URLSearchParams({
          show_image: String(showImage),
          show_price: String(showPrice),
          price_type: priceType,
        }).toString()
        const [pdfRes, deliveryRes] = await Promise.all([
          fetch(`${API_URL}/deliveries/${id}/pdf?${query}`, { headers }),
          fetch(`${API_URL}/deliveries/${id}`, { headers }),
        ])
        if (!deliveryRes.ok) throw new Error("โหลดข้อมูลใบส่งของไม่สำเร็จ")
        const deliveryJson = await deliveryRes.json()
        if (active) {
          setDeliveryNumber(deliveryJson.delivery_number || "")
        }
        const res = pdfRes
        if (!res.ok) {
          // เช่น ใบที่ยังเป็น draft → backend บอกเหตุผลมาใน detail
          const body = await res.json().catch(() => null)
          throw new Error(body?.detail || "โหลด PDF ไม่สำเร็จ")
        }
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        if (active) setPdfUrl(objectUrl)
      } catch (err) {
        if (active) setError(err instanceof Error && err.message ? err.message : "โหลด PDF ไม่สำเร็จ")
      }
    }

    setError("")
    setPdfUrl("")
    loadPdf()

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [params.id, showImage, showPrice, priceType])

  const id = Array.isArray(params.id) ? params.id[0] : params.id

  const fileName = deliveryNumber
    ? `ใบส่งของ${deliveryNumber}.pdf`
    : id
      ? `ใบส่งของ${id}.pdf`
      : "ใบส่งของ.pdf"

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { width: 210mm; height: 297mm; margin: 0; background: white; }
          .print-hidden { display: none !important; }
          iframe { width: 210mm !important; height: 297mm !important; }
        }
      `}</style>
      <div className="p-3 sm:p-4 bg-white border-b border-gray-200 print-hidden space-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-700">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showImage}
              onChange={(e) => setShowImage(e.target.checked)}
              className="w-4 h-4"
            />
            แสดงรูปสินค้า
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              className="w-4 h-4"
            />
            แสดงราคา
          </label>
          <div className="inline-flex items-center gap-2">
            <span className={showPrice ? "" : "text-gray-400"}>ใช้ราคา</span>
            <select
              value={priceType}
              onChange={(e) => setPriceType(e.target.value)}
              disabled={!showPrice}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
            >
              {PRICE_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <a
            href={pdfUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white text-sm flex-1 sm:flex-none ${
              pdfUrl ? "" : "pointer-events-none opacity-50"
            }`}
          >
            เปิด PDF
          </a>
          <a
            href={pdfUrl || undefined}
            download={fileName}
            className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-blue-600 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex-1 sm:flex-none ${
              pdfUrl ? "" : "pointer-events-none opacity-50"
            }`}
          >
            ดาวน์โหลด PDF
          </a>
        </div>
      </div>
      {error ? (
        <div className="flex-1 flex items-center justify-center p-6 text-gray-600">{error}</div>
      ) : !pdfUrl ? (
        <div className="flex-1 flex items-center justify-center p-6 text-gray-600">กำลังสร้าง PDF...</div>
      ) : isTouchDevice ? (
        <PdfPages url={pdfUrl} />
      ) : (
        <iframe title="Delivery PDF" src={pdfUrl} className="flex-1 w-full border-0 bg-white min-h-[60vh]" />
      )}
    </div>
  )
}
