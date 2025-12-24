import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  basePath: "/stock",
  assetPrefix: "/stock",

  images: { unoptimized: true },

  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "https://api-stock.cleanovaworld.com",
    // Ensure NEXT_PUBLIC_API_BASE_URL is available and falls back to a relative "/api"
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api` : "/api"),
    NEXT_PUBLIC_BASE_PATH: "/stock",
  },

  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "@": path.resolve(__dirname) }
    return config
  },
}

export default nextConfig