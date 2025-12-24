import type React from "react"
import InitClient from "../components/init-client"
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
      <body className="text-black">
        {/* client initializer: normalize localStorage stored URLs (logo/images) */}
        {/* kept minimal — runs once on first client mount */}
        <InitClient />
        {children}
      </body>
    </html>
  )
}
