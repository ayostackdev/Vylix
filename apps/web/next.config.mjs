/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  async rewrites() {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    return [
      ...(apiBaseUrl !== 'http://localhost:4000'
        ? [
            {
              source: '/api/auth/:path*',
              destination: '/api/auth/:path*',
            },
          ]
        : []),
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

export default pwaConfig(nextConfig);
