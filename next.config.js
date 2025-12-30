/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracing: true,
  
  images: {
    domains: ['localhost'],
    unoptimized: true,
    // Allow images from public folder
    remotePatterns: [],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  // Configuração para hot-reload no Docker
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

