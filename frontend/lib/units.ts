/**
 * ระบบหน่วยคู่: สต็อกเก็บเป็น "หน่วยฐาน" ของสินค้า (เช่น แกลลอน)
 * ส่วนลิตรเป็นหน่วยที่ผู้ใช้กรอก/อ่านเพิ่ม โดยแปลงผ่าน litre_per_unit
 *
 * litre_per_unit ว่าง/0 = สินค้านั้นไม่มีการแปลงหน่วย (ทำงานเหมือนเดิม)
 */

export const LITRE_UNIT = "ลิตร"

export interface UnitProduct {
  unit?: string
  litre_per_unit?: number | string | null
}

/** ตัวคูณลิตรต่อ 1 หน่วยฐาน คืน null ถ้าสินค้านี้แปลงหน่วยไม่ได้ */
export function litrePerUnit(product?: UnitProduct | null): number | null {
  if (!product) return null
  const raw = Number(product.litre_per_unit ?? 0)
  return Number.isFinite(raw) && raw > 0 ? raw : null
}

export function supportsLitre(product?: UnitProduct | null): boolean {
  return litrePerUnit(product) !== null
}

/** ตัวเลือกหน่วยที่กรอกได้สำหรับสินค้าหนึ่งตัว */
export function unitOptions(product?: UnitProduct | null): string[] {
  const base = product?.unit || "หน่วย"
  return supportsLitre(product) ? [base, LITRE_UNIT] : [base]
}

/** แปลงจำนวนที่ผู้ใช้กรอก (ตามหน่วยที่เลือก) ให้เป็นจำนวนหน่วยฐานที่ใช้ตัด/บวกสต็อก */
export function toBaseQuantity(
  inputQuantity: number,
  inputUnit: string,
  product?: UnitProduct | null,
): number {
  const factor = litrePerUnit(product)
  if (factor && inputUnit === LITRE_UNIT) {
    // ปัดที่ 4 ตำแหน่งให้ตรงกับ DECIMAL(12,4) ในฐานข้อมูล
    return Math.round((inputQuantity / factor) * 10000) / 10000
  }
  return inputQuantity
}

/** แปลงจำนวนหน่วยฐานเป็นลิตร คืน null ถ้าแปลงไม่ได้ */
export function toLitre(baseQuantity: number, product?: UnitProduct | null): number | null {
  const factor = litrePerUnit(product)
  if (!factor) return null
  return Math.round(baseQuantity * factor * 10000) / 10000
}

/** ตัดศูนย์ท้ายทิ้ง: 12 -> "12", 7.6000 -> "7.6", 1.3158 -> "1.3158" */
export function formatQty(value: number | string | null | undefined): string {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return "0"
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

/**
 * ข้อความคงเหลือ ถ้าสินค้าแปลงหน่วยได้จะวงเล็บลิตรต่อท้าย
 * เช่น "22.4 แกลลอน (85.12 ลิตร)"
 */
export function formatStock(baseQuantity: number | string | null | undefined, product?: UnitProduct | null): string {
  const base = Number(baseQuantity ?? 0)
  const unit = product?.unit || ""
  const litre = toLitre(base, product)
  const head = `${formatQty(base)}${unit ? ` ${unit}` : ""}`
  return litre === null ? head : `${head} (${formatQty(litre)} ${LITRE_UNIT})`
}
