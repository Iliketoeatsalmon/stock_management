"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { FileText, RefreshCw, AlertCircle } from "lucide-react"

interface LogEntry {
  service: string
  stdout?: string
  stderr?: string
  error?: string
  success?: boolean
}

interface LogResponse {
  logs: LogEntry[]
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<string>("all")
  const [lines, setLines] = useState(100)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        lines: String(lines),
      })
      if (selectedService !== "all") {
        params.append("service", selectedService)
      }
      const response = await api.get(`/api/system/logs?${params}`) as LogResponse
      setLogs(response.logs)
    } catch (error: any) {
      console.error("Failed to fetch logs:", error)
      if (error?.message?.includes("403")) {
        alert("Admin only")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [selectedService, lines])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, selectedService, lines])

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="System Logs" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
              </div>
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service
                  </label>
                  <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Services</option>
                    <option value="stock_api">Backend (stock_api)</option>
                    <option value="stock_web">Frontend (stock_web)</option>
                    <option value="stock_db">Database (stock_db)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lines
                  </label>
                  <select
                    value={lines}
                    onChange={(e) => setLines(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={50}>50 lines</option>
                    <option value={100}>100 lines</option>
                    <option value={200}>200 lines</option>
                    <option value={500}>500 lines</option>
                    <option value={1000}>1000 lines</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auto Refresh
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      Refresh every 5s
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Logs Display */}
            <div className="space-y-4">
              {loading && logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Loading logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No logs available
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
                      <span className="font-mono font-semibold">{log.service}</span>
                      {log.error && (
                        <span className="flex items-center gap-1 text-red-400 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          Error
                        </span>
                      )}
                    </div>

                    {log.error ? (
                      <div className="p-4 bg-red-50 text-red-700 font-mono text-sm">
                        {log.error}
                      </div>
                    ) : (
                      <>
                        {log.stdout && (
                          <div className="border-b border-gray-200">
                            <div className="bg-gray-100 px-4 py-1 text-xs font-semibold text-gray-600">
                              STDOUT
                            </div>
                            <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-800 whitespace-pre-wrap break-words">
                              {log.stdout}
                            </pre>
                          </div>
                        )}

                        {log.stderr && (
                          <div>
                            <div className="bg-red-100 px-4 py-1 text-xs font-semibold text-red-700">
                              STDERR
                            </div>
                            <pre className="p-4 overflow-x-auto text-sm font-mono text-red-700 whitespace-pre-wrap break-words">
                              {log.stderr}
                            </pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
