/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pms/validation', '@pms/types', '@pms/utils'],
};
export default nextConfig;
