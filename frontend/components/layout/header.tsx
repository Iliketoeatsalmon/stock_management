"use client"

import { useEffect, useState } from "react"
import { Bell, User, LogOut } from "lucide-react"
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
      setUser(JSON.parse(userData))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/")
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>

        <div className="flex items-center gap-4">
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <Bell className="w-5 h-5" />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ
          </button>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{user?.full_name || "User"}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role || "staff"}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
