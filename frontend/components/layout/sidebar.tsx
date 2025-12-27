"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  Truck,
  Users,
  Building2,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  X,
} from "lucide-react"

const menuItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/products", icon: Package, label: "สินค้า" },
  { href: "/stock-in", icon: ArrowDownToLine, label: "รับเข้าสินค้า" },
  { href: "/deliveries", icon: Truck, label: "ใบส่งของ" },
  { href: "/customers", icon: Building2, label: "ลูกค้า" },
  { href: "/suppliers", icon: Users, label: "Supplier" },
  { href: "/reports", icon: FileText, label: "รายงาน" },
  { href: "/users", icon: Settings, label: "ผู้ใช้งาน" },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    const open = () => setIsOpen(true)
    const close = () => setIsOpen(false)
    const toggle = () => setIsOpen((prev) => !prev)
    window.addEventListener("sidebar:open", open)
    window.addEventListener("sidebar:close", close)
    window.addEventListener("sidebar:toggle", toggle)
    return () => {
      window.removeEventListener("sidebar:open", open)
      window.removeEventListener("sidebar:close", close)
      window.removeEventListener("sidebar:toggle", toggle)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/")
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-transform duration-200 md:static md:translate-x-0 md:h-screen md:sticky md:top-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Stock</h1>
                <p className="text-xs text-slate-400">Management</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="md:hidden text-slate-400 hover:text-slate-200"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                      isActive
                        ? "bg-green-600/20 text-green-400 border border-green-600/50"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-300 border border-transparent"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="flex-1 font-medium text-sm">{item.label}</span>
                    {isActive && (
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:bg-red-600/20 hover:text-red-400 hover:border hover:border-red-600/50 rounded-lg transition-all group font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span className="flex-1 text-sm">ออกจากระบบ</span>
          </button>
        </div>
      </aside>
    </>
  )
}
