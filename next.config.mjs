/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  assetPrefix: process.env.NODE_ENV !== "development" ? "https://ytfs-static-assets.b-cdn.net/" : undefined
};

export default nextConfig;
