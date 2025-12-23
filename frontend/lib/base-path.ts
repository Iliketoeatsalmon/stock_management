export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ""

export const withBasePath = (path: string) => {
  if (!BASE_PATH) return path
  if (path === "/") return BASE_PATH
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`
}
