/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd()
};

export default nextConfig;
