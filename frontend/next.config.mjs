import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/stock"
const apiPublicBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"
const backendInternalUrl = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  basePath,
  assetPrefix: basePath,

  images: { unoptimized: true },

  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "https://api-stock.cleanovaworld.com",
    NEXT_PUBLIC_API_BASE_URL: apiPublicBaseUrl,
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendInternalUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendInternalUrl}/uploads/:path*`,
      },
    ]
  },

  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "@": path.resolve(__dirname) }
    return config
  },
}

export default nextConfig
