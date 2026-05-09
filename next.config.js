/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    preloadEntriesOnStart: false,
    serverSourceMaps: false,
    webpackMemoryOptimizations: true,
  },
}

module.exports = nextConfig
