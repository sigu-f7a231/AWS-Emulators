/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // バックエンドURLは docker-compose 内部ネットワークで解決
  async rewrites() {
    return [];
  },
  // サーバーコンポーネントからのフェッチで使う
  serverRuntimeConfig: {
    backendUrl: process.env.BACKEND_INTERNAL_URL || 'http://python:8000',
  },
};

export default nextConfig;
