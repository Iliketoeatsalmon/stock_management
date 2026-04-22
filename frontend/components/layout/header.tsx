"use client"

import { useEffect, useState } from "react"
import { Menu, User, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

interface UserData {
  full_name: string
  role: string
}

export function Header({ title }: { title: string }) {
  const [user, setUser] = useState<UserData | null>(null)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      try { setUser(JSON.parse(userData)) } catch {}
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/")
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("sidebar:open"))}
            className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-800 truncate">{title}</h2>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-700 leading-tight">{user?.full_name || "User"}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role || "staff"}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
