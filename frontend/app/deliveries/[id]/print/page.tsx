"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { API_URL } from "@/lib/api"

export default function DeliveryPrintPage() {
  const params = useParams()
  const [pdfUrl, setPdfUrl] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [deliveryNumber, setDeliveryNumber] = useState<string>("")

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id
    if (!id) return
    let active = true
    let objectUrl: string | null = null

    const loadPdf = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const [pdfRes, deliveryRes] = await Promise.all([
          fetch(`${API_URL}/deliveries/${id}/pdf`, { headers }),
          fetch(`${API_URL}/deliveries/${id}`, { headers }),
        ])
        if (!deliveryRes.ok) throw new Error("Failed to load delivery")
        const deliveryJson = await deliveryRes.json()
        if (active) {
          setDeliveryNumber(deliveryJson.delivery_number || "")
        }
        const res = pdfRes
        if (!res.ok) throw new Error("Failed to load PDF")
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        if (active) setPdfUrl(objectUrl)
      } catch (err) {
        if (active) setError("Failed to load PDF")
      }
    }

    loadPdf()

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [params.id])

  if (error) {
    return <div className="p-6 text-center text-gray-600">{error}</div>
  }

  if (!pdfUrl) {
    return <div className="p-6 text-center text-gray-600">Loading PDF...</div>
  }

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
      <div className="p-3 sm:p-4 flex flex-wrap gap-2 justify-end bg-white border-b border-gray-200 print-hidden">
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white text-sm flex-1 sm:flex-none"
        >
          เปิด PDF
        </a>
        <a
          href={pdfUrl}
          download={fileName}
          className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-blue-600 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex-1 sm:flex-none"
        >
          ดาวน์โหลด PDF
        </a>
      </div>
      <iframe title="Delivery PDF" src={pdfUrl} className="flex-1 w-full border-0 bg-white min-h-[60vh]" />
    </div>
  )
}
