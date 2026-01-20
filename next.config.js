/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone apenas em produção (não funciona bem com hot reload)
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone',
    outputFileTracing: true,
  }),
  
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
    // Garantir que react-simple-maps e suas dependências sejam resolvidas corretamente
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    // Garantir resolução correta de módulos
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    // Garantir que módulos sejam encontrados corretamente
    config.resolve.modules = [
      ...(config.resolve.modules || []),
      'node_modules',
    ];
    return config;
  },
};

module.exports = nextConfig;

