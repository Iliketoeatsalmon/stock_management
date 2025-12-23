"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { loadCompanySettings } from "@/lib/company"
import { API_URL } from "@/lib/api"
import { format } from "date-fns"

export default function DeliveryPrintPage() {
  const params = useParams()
  const [companyInfo, setCompanyInfo] = useState(loadCompanySettings())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const chunkItems = (items: any[] = [], size = 9) => {
    const pages: any[][] = []
    for (let i = 0; i < items.length; i += size) {
      pages.push(items.slice(i, i + size))
    }
    return pages.length ? pages : [[]]
  }

  useEffect(() => {
    setCompanyInfo(loadCompanySettings())
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
        const res = await fetch(`${API_URL}/api/deliveries/${params.id}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ")
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error("failed to load delivery", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  if (loading) {
    return <div className="p-6 text-center text-gray-600">กำลังโหลด...</div>
  }
  if (!data) {
    return <div className="p-6 text-center text-gray-600">ไม่พบใบส่งของ</div>
  }

  const pages = chunkItems(data.items, 9)

  return (
    <div className="bg-white text-black text-sm print:text-xs">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          .print-button { display: none; }
          .print-table { min-height: 130mm; }
          .signature-block { break-inside: avoid; page-break-inside: avoid; }
          .signature-block * { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="print-button p-4 text-right">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          พิมพ์
        </button>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {pages.map((items: any[], pageIndex: number) => (
          <div
            key={pageIndex}
            className="border border-gray-400"
            style={{ pageBreakAfter: pageIndex === pages.length - 1 ? "auto" : "always" }}
          >
            {/* Header */}
            <div className="flex border-b border-gray-400">
              <div className="w-1/3 border-r border-gray-400 flex items-center justify-center p-3">
                <img src={companyInfo.logo} alt="logo" className="max-h-20 object-contain" />
              </div>
              <div className="w-2/3 p-3 leading-relaxed">
                <div className="font-bold text-base">{companyInfo.nameEn}</div>
                <div className="font-bold text-base">{companyInfo.nameTh}</div>
                <div>{companyInfo.address}</div>
                <div>Tax ID: {companyInfo.taxId || "-"}</div>
                <div>{companyInfo.tel}</div>
                <div>{companyInfo.fax}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 border-b border-gray-400">
              <div className="p-3 space-y-1 border-r border-gray-400">
                <div><strong>Attention:</strong> {data.customer_name || "-"}</div>
                <div><strong>Company:</strong> {data.customer_name || "-"}</div>
                <div><strong>Address:</strong> {data.customer_address || "-"}</div>
                <div><strong>Tel:</strong> {data.customer_phone || "-"}</div>
                <div><strong>Fax:</strong> -</div>
              </div>
              <div className="p-3 space-y-1">
                <div><strong>Date:</strong> {format(new Date(data.delivery_date), "dd/MM/yyyy")}</div>
                <div><strong>No:</strong> {data.delivery_number}</div>
                <div>
                  <strong>ผู้ทำรายการ:</strong>{" "}
                  {data.created_by_name || "-"}
                  {data.created_by_phone || data.created_by_tel ? ` (Tel: ${data.created_by_phone || data.created_by_tel})` : ""}
                </div>
                <div><strong>Tel:</strong> {data.customer_phone || "-"}</div>
                <div><strong>Delivery to:</strong> {data.customer_name || "-"}</div>
                <div><strong>Status:</strong> {data.status}</div>
              </div>
            </div>

            {/* Items table */}
            <div className="print-table">
              <div className="border border-gray-400 border-b-0 px-3 py-2 font-semibold text-sm bg-gray-100 text-center">
                ใบส่งสินค้า
              </div>
              <table className="w-full border-b border-gray-400">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2 w-12">ลำดับ</th>
                    <th className="border border-gray-300 p-2">รายการสินค้า</th>
                    <th className="border border-gray-300 p-2 w-16">จำนวน</th>
                    <th className="border border-gray-300 p-2 w-20">หน่วย</th>
                    <th className="border border-gray-300 p-2 w-24">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => (
                    <tr key={item.id || idx}>
                      <td className="border border-gray-200 p-2 text-center">{pageIndex * 9 + idx + 1}</td>
                      <td className="border border-gray-200 p-2">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-600">{item.product_code}</div>
                      </td>
                      <td className="border border-gray-200 p-2 text-center">{item.quantity}</td>
                      <td className="border border-gray-200 p-2 text-center">{item.unit}</td>
                      <td className="border border-gray-200 p-2">{item.note || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="signature-block" style={{ pageBreakInside: "avoid" }}>
              <div className="grid grid-cols-2 text-center">
                <div className="p-3">
                  ส่วนของลูกค้า/ผู้รับสินค้า<br />
                  <div className="mt-2">..............................</div>
                  <div className="mt-1">........./....../........</div>
                </div>
                <div className="p-3">
                  ส่วนของบริษัท/ผู้ส่งสินค้า<br />
                  <div className="mt-2">..............................</div>
                  <div className="mt-1">........./....../........</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
