import { formatQty } from "@/lib/units"

export interface StockCheckItem {
  product_id: number
  /** ต้องเป็นจำนวนในหน่วยฐานของสินค้าแล้ว (แปลงจากลิตรก่อนส่งเข้ามา) */
  quantity: number
}

export interface StockCheckProduct {
  id: number
  code?: string
  name?: string
  current_stock: number
}

/**
 * Mirrors the backend's aggregate-by-product check in confirm_delivery so the
 * user sees the error before submitting instead of after a round trip.
 * Returns an error message, or null if every product has enough stock.
 */
export function validateItemsAgainstStock(
  items: StockCheckItem[],
  products: StockCheckProduct[],
): string | null {
  const requiredByProduct = new Map<number, number>()
  for (const item of items) {
    if (!item.product_id) continue
    requiredByProduct.set(item.product_id, (requiredByProduct.get(item.product_id) || 0) + (Number(item.quantity) || 0))
  }

  for (const [productId, required] of requiredByProduct) {
    const product = products.find((p) => Number(p.id) === productId)
    if (!product) continue
    if (required > product.current_stock) {
      const label = product.code ? `${product.code} - ${product.name}` : product.name || `สินค้า #${productId}`
      return `สต๊อกไม่พอสำหรับ ${label} (มี ${formatQty(product.current_stock)}, ต้องการ ${formatQty(required)})`
    }
  }
  return null
}
