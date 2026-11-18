"use client"

import type React from "react"
import { useEffect, useState } from "react"

type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | string | null | undefined
  onValueChange: (value: number) => void
  /** true = ตัดทศนิยมทิ้ง (จำนวนขั้นต่ำ ฯลฯ) */
  integer?: boolean
}

const toText = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v))

const toNumber = (text: string) => (text.trim() === "" ? 0 : Number(text))

/**
 * ช่องกรอกตัวเลขที่ลบค่าเดิมได้จริง
 *
 * ช่อง <input type="number"> ปกติที่ผูกกับ state แบบ `parseFloat(v) || 0`
 * จะเด้งกลับเป็น 0 ทันทีที่ลบจนว่าง และพิมพ์ต่อท้ายได้ "020" แทน "20"
 * ตัวนี้เก็บข้อความที่กำลังพิมพ์ไว้เอง (ว่างได้, "0." ได้) แล้วค่อยส่งตัวเลขให้ parent
 * และเลือกตัวเลขทั้งหมดตอนคลิก พิมพ์ทับค่าเริ่มต้นได้เลย
 */
export function NumberInput({ value, onValueChange, integer = false, onFocus, onBlur, ...rest }: NumberInputProps) {
  const [text, setText] = useState(() => toText(value))

  // ค่าจากข้างนอกเปลี่ยน (เช่น ล้างฟอร์ม เปลี่ยนสินค้า) ให้ตามไป
  // แต่ถ้าตัวเลขเท่ากับที่กำลังพิมพ์อยู่ ห้ามทับ ไม่งั้น "" หรือ "0." จะถูกเขียนกลับเป็น "0"
  useEffect(() => {
    setText((current) => (toNumber(current) === Number(value ?? 0) ? current : toText(value)))
  }, [value])

  return (
    <input
      {...rest}
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        if (raw.trim() === "") {
          onValueChange(0)
          return
        }
        const parsed = integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw)
        if (!Number.isNaN(parsed)) onValueChange(parsed)
      }}
      onFocus={(e) => {
        // เลื่อนไปหลัง event คลิก ไม่งั้นเบราว์เซอร์ล้างการเลือกตอนปล่อยเมาส์
        const el = e.currentTarget
        setTimeout(() => el.select(), 0)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        // ออกจากช่องแล้วให้จอตรงกับค่าที่เก็บจริง: ว่าง -> "0", "1.5" ในช่องจำนวนเต็ม -> "1"
        setText(toText(value))
        onBlur?.(e)
      }}
    />
  )
}
