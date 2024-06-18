import projectPackage from "./package.json" assert { type: "json" };

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  assetPrefix: process.env.NODE_ENV !== "development" ? "https://ytfs-static-assets.b-cdn.net/" : undefined,

  publicRuntimeConfig: {
    buildVersion: projectPackage.version
  },
};

export default nextConfig;
