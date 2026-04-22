/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['date-fns', 'shiki'],
  },
};

export default nextConfig;
