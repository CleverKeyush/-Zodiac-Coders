/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Temporarily ignore build errors during type checking
    ignoreBuildErrors: true,
  },
  webpack: config => {
    // Externalize packages that cause issues in the browser
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // Handle face-api.js models
    config.module.rules.push({
      test: /\.(bin|dat|wasm)$/,
      use: 'file-loader',
    });

    // Handle worker files from dependencies
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: { loader: 'worker-loader' },
    });

    // Fix for @gradio/client fetch.node issue
    config.resolve.alias = {
      ...config.resolve.alias,
      './fetch.node': false,
      'node-fetch': false,
    };

    // Fix for WalletConnect HeartbeatWorker and other worker issues
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
      url: false,
    };

    // Fix for worker module issues
    config.optimization = {
      ...config.optimization,
      minimize: false, // Temporarily disable minification to avoid worker issues
    };

    return config;
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=self, microphone=self',
          },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    domains: ['ipfs.io', 'gateway.pinata.cloud'],
    formats: ['image/webp', 'image/avif'],
  },
};

module.exports = nextConfig;