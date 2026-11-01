"use client"

import { NumberInput } from "@/components/ui/number-input"
import { LITRE_UNIT, formatQty, supportsLitre, toBaseQuantity, unitOptions, type UnitProduct } from "@/lib/units"

interface QuantityInputProps {
  /** จำนวนในหน่วยที่ผู้ใช้กรอก (ไม่ใช่หน่วยฐาน) */
  value: number
  /** หน่วยที่ผู้ใช้เลือกกรอก */
  unit: string
  product?: UnitProduct | null
  onChange: (next: { quantity: number; unit: string; baseQuantity: number }) => void
  className?: string
  min?: number
}

/**
 * ช่องกรอกจำนวน + ปุ่มสลับหน่วย (เช่น แกลลอน / ลิตร)
 * สินค้าที่ไม่ได้ตั้ง litre_per_unit จะไม่มีตัวสลับ แสดงหน่วยเดียวเหมือนเดิม
 */
export function QuantityInput({
  value,
  unit,
  product,
  onChange,
  className = "",
  min = 0,
}: QuantityInputProps) {
  const options = unitOptions(product)
  const canConvert = supportsLitre(product)
  const activeUnit = options.includes(unit) ? unit : options[0]

  const emit = (quantity: number, nextUnit: string) => {
    onChange({
      quantity,
      unit: nextUnit,
      baseQuantity: toBaseQuantity(quantity, nextUnit, product),
    })
  }

  const baseQuantity = toBaseQuantity(value, activeUnit, product)
  const showConversion = canConvert && activeUnit === LITRE_UNIT && value > 0

  return (
    <div>
      <div className="flex gap-2">
        <NumberInput
          value={value}
          onValueChange={(quantity) => emit(quantity, activeUnit)}
          className={`flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-right bg-white text-slate-900 ${className}`}
          min={min}
          step="any"
        />
        {options.length > 1 ? (
          <select
            value={activeUnit}
            onChange={(e) => emit(value, e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 text-sm flex-shrink-0"
          >
            {options.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        ) : (
          <span className="px-2 py-2 text-sm text-gray-500 flex-shrink-0 self-center">{activeUnit}</span>
        )}
      </div>
      {showConversion && (
        <p className="mt-1 text-xs text-blue-700">
          = {formatQty(baseQuantity)} {product?.unit}
        </p>
      )}
    </div>
  )
}
