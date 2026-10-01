/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pms/validation', '@pms/types'],
};
export default nextConfig;
