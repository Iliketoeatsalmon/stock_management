"use client"

import { useEffect, useRef, useState } from "react"

// วาดละเอียดกว่าจอ เพื่อให้ถ่างนิ้วซูมอ่านตัวหนังสือเล็กในใบส่งของได้
const RENDER_SCALE = 2.5

/**
 * แสดง PDF ทีละหน้าให้พอดีความกว้างจอ ด้วย pdf.js
 * ใช้แทน iframe บนมือถือ/แท็บเล็ต เพราะเบราว์เซอร์มือถือฝัง PDF ใน iframe ได้ไม่ดี
 */
export function PdfPages({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let loadingTask: { destroy: () => Promise<void> } | null = null

    const render = async () => {
      setStatus("loading")
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf")
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.js",
          import.meta.url,
        ).toString()

        // isEvalSupported: false ปิดช่องโหว่ CVE-2024-4367 ของ pdf.js รุ่น < 4.2
        const task = pdfjs.getDocument({ url, isEvalSupported: false })
        loadingTask = task
        const doc = await task.promise

        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
          if (cancelled) return
          const page = await doc.getPage(pageNumber)
          const scale = (container.clientWidth * RENDER_SCALE) / page.getViewport({ scale: 1 }).width
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement("canvas")
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.className = "block w-full h-auto bg-white shadow"
          container.appendChild(canvas)
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise
          if (!cancelled) setStatus("ready")
        }
      } catch (err) {
        console.error("Failed to render PDF:", err)
        if (!cancelled) setStatus("failed")
      }
    }

    render()

    return () => {
      cancelled = true
      loadingTask?.destroy()
      container.replaceChildren()
    }
  }, [url])

  return (
    <div className="flex-1 p-2 space-y-2">
      {status === "loading" && <div className="p-6 text-center text-gray-600">กำลังสร้าง PDF...</div>}
      {status === "failed" && (
        <div className="p-6 text-center text-gray-600">
          แสดงตัวอย่างไม่ได้ กด &quot;เปิด PDF&quot; หรือ &quot;ดาวน์โหลด PDF&quot; ด้านบนแทน
        </div>
      )}
      <div ref={containerRef} className="space-y-2" />
    </div>
  )
}
