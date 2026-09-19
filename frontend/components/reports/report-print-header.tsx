"use client"

import { useEffect, useState } from "react"
import { fetchCompanySettings, type CompanySettings } from "@/lib/company"

interface ReportPrintHeaderProps {
  title: string
  meta?: string
}

export function ReportPrintHeader({ title, meta }: ReportPrintHeaderProps) {
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [printedAt] = useState(() => new Date())

  useEffect(() => {
    fetchCompanySettings().then(setCompany)
  }, [])

  return (
    <div className="hidden print:flex print:items-center print:gap-4 print:border-b print:border-gray-400 print:pb-3 print:mb-3">
      {company?.logo ? (
        <img src={company.logo} alt="logo" className="h-14 w-auto object-contain" />
      ) : null}
      <div className="flex-1">
        <div className="text-base font-bold text-gray-900">{company?.nameTh || "บริษัทของคุณ"}</div>
        {company?.address ? <div className="text-[10px] text-gray-600">{company.address}</div> : null}
        <div className="text-[10px] text-gray-600">
          {company?.tel ? `โทร. ${company.tel}` : null}
          {company?.taxId ? `  |  ${company.taxId}` : null}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        {meta ? <div className="text-[10px] text-gray-600">{meta}</div> : null}
        <div className="text-[10px] text-gray-500">
          พิมพ์เมื่อ {printedAt.toLocaleString("th-TH")}
        </div>
      </div>
    </div>
  )
}
