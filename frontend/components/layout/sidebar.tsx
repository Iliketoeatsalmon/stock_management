"use client"

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
} from "lucide-react"

const menuItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/products", icon: Package, label: "สินค้า" },
  { href: "/stock-in", icon: ArrowDownToLine, label: "รับสินค้าเข้า" },
  { href: "/deliveries", icon: Truck, label: "ใบส่งของ" },
  { href: "/customers", icon: Building2, label: "ลูกค้า" },
  { href: "/suppliers", icon: Users, label: "Supplier" },
  { href: "/reports", icon: FileText, label: "รายงาน" },
  { href: "/users", icon: Settings, label: "ผู้ใช้งาน" },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/")
  }

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Stock</h1>
            <p className="text-xs text-slate-400">Management</p>
          </div>
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
  )
}
