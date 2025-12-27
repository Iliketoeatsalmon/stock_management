"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { fetchCompanySettings, loadCompanySettings } from "@/lib/company"
import { API_URL } from "@/lib/api"
import { format } from "date-fns"

const PAGE_SIZE = 10

function chunkItems(items: any[] = [], size = PAGE_SIZE) {
  const pages: any[][] = []
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size))
  }
  return pages.length ? pages : [[]]
}

export default function DeliveryPrintPage() {
  const params = useParams()
  const [companyInfo, setCompanyInfo] = useState(loadCompanySettings())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchCompanySettings()
      .then((settings) => {
        if (active) setCompanyInfo(settings)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
        const res = await fetch(`${API_URL}/deliveries/${params.id}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        if (!res.ok) throw new Error("Failed to load delivery")
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
    return <div className="p-6 text-center text-gray-600">Loading...</div>
  }
  if (!data) {
    return <div className="p-6 text-center text-gray-600">Delivery not found</div>
  }

  const pages = chunkItems(data.items, PAGE_SIZE)
  const statusLabel =
    data.status === "confirmed" ? "ยืนยันแล้ว" : data.status === "cancelled" ? "ยกเลิก" : "รอดำเนินการ"

  return (
    <div className="bg-white text-black text-sm print:text-xs print-root">
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          .print-button { display: none; }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .page, .page-header, .signature-block { break-inside: avoid; page-break-inside: avoid; }
          .signature-block * { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="print-button p-4 text-right">
        <button
          onClick={() => window.open(`/api/deliveries/${params.id}/pdf`, "_blank")}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 mr-2"
        >
          Export PDF
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          พิมพ์
        </button>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {pages.map((items: any[], pageIndex: number) => {
          const emptyRows = Math.max(PAGE_SIZE - items.length, 0)
          return (
            <div key={pageIndex} className="page border border-gray-400 flex flex-col min-h-[270mm]">
              <div className="page-header">
                <div className="flex border-b border-gray-400">
                  <div className="w-1/3 border-r border-gray-400 flex items-center justify-center p-3">
                    {companyInfo.logo ? (
                      <img src={companyInfo.logo} alt="logo" className="max-h-20 object-contain" />
                    ) : (
                      <div className="text-xs text-gray-500">No Logo</div>
                    )}
                  </div>
                  <div className="w-2/3 p-3 leading-relaxed">
                    <div className="font-bold text-base">{companyInfo.nameEn}</div>
                    <div className="font-bold text-base">{companyInfo.nameTh}</div>
                    <div>{companyInfo.address}</div>
                    <div>Tax ID: {companyInfo.taxId || "-"}</div>
                    <div>Tel: {companyInfo.tel || "-"}</div>
                    <div>Fax: {companyInfo.fax || "-"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-b border-gray-400 text-sm">
                  <div className="p-3 space-y-1 border-r border-gray-400">
                    <div><strong>บริษัท:</strong> {data.customer_name || "-"}</div>
                    <div><strong>ส่งสินค้าไปที่:</strong> {data.customer_name || "-"}</div>
                    <div><strong>ผู้ติดต่อ:</strong> {data.customer_contact_person || "-"}</div>
                    <div><strong>ที่อยู่:</strong> {data.customer_address || "-"}</div>
                    <div><strong>โทรศัพท์:</strong> {data.customer_phone || "-"}</div>
                    <div><strong>แฟกซ์:</strong> -</div>
                  </div>
                  <div className="p-3 space-y-1">
                    <div><strong>วันที่:</strong> {format(new Date(data.delivery_date), "dd/MM/yyyy")}</div>
                    <div><strong>เลขที่:</strong> {data.delivery_number}</div>
                    <div className="pt-1 text-right">
                      <strong>ผู้ทำรายการ:</strong> {data.created_by_name || "-"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="page-body flex-1 flex flex-col">
                <div className="border border-gray-400 border-b-0 px-3 py-2 font-semibold text-sm bg-gray-100 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span>ใบส่งสินค้า</span>
                    <span className="relative top-px inline-flex items-center px-2 py-0.5 text-[10px] text-gray-500 border border-gray-300 rounded-full opacity-70">
                      {statusLabel}
                    </span>
                  </div>
                </div>
                <table className="w-full border-b border-gray-400">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 p-2 w-12">ลำดับ</th>
                      <th className="border border-gray-300 p-2 w-24">รหัสสินค้า</th>
                      <th className="border border-gray-300 p-2">รายการสินค้า</th>
                      <th className="border border-gray-300 p-2 w-16">จำนวน</th>
                      <th className="border border-gray-300 p-2 w-20">หน่วย</th>
                      <th className="border border-gray-300 p-2 w-24">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, idx: number) => (
                      <tr key={item.id || idx}>
                        <td className="border border-gray-200 p-2 text-center">{pageIndex * PAGE_SIZE + idx + 1}</td>
                        <td className="border border-gray-200 p-2 text-center">{item.product_code || "-"}</td>
                        <td className="border border-gray-200 p-2">{item.product_name}</td>
                        <td className="border border-gray-200 p-2 text-center">{item.quantity}</td>
                        <td className="border border-gray-200 p-2 text-center">{item.unit}</td>
                        <td className="border border-gray-200 p-2">{item.note || ""}</td>
                      </tr>
                    ))}
                    {Array.from({ length: emptyRows }).map((_, idx) => (
                      <tr key={`empty-${pageIndex}-${idx}`} className="h-6">
                        <td className="border border-gray-200 p-2 text-center"><span>&nbsp;</span></td>
                        <td className="border border-gray-200 p-2 text-center"><span>&nbsp;</span></td>
                        <td className="border border-gray-200 p-2"><span>&nbsp;</span></td>
                        <td className="border border-gray-200 p-2 text-center"><span>&nbsp;</span></td>
                        <td className="border border-gray-200 p-2 text-center"><span>&nbsp;</span></td>
                        <td className="border border-gray-200 p-2"><span>&nbsp;</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="signature-block mt-auto pt-4">
                <div className="grid grid-cols-2 text-center">
                  <div className="p-2">
                    ส่วนของลูกค้า/ผู้รับสินค้า
                    <div className="mt-2">..............................</div>
                    <div className="mt-1">........./....../........</div>
                  </div>
                  <div className="p-2">
                    ส่วนของบริษัท/ผู้ส่งสินค้า
                    <div className="mt-2">..............................</div>
                    <div className="mt-1">........./....../........</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
