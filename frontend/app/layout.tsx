import type React from "react"
import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Stock Management System",
  description: "ระบบจัดการสต๊อกสินค้า",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className="text-black">{children}</body>
    </html>
  )
}
