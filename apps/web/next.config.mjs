import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {import('next').NextConfig} */
const createNextConfig = (phase) => ({
  reactStrictMode: true,
  transpilePackages: ['@pms/validation', '@pms/types'],
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-prod',
});

export default createNextConfig;
