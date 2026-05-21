const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath: "/ABCFPT",
  assetPrefix: "/ABCFPT/",
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: "/ABCFPT",
    NEXT_PUBLIC_SOCKET_SERVER_URL: process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || process.env.SOCKET_SERVER_URL || "http://localhost:4000",
    SOCKET_SERVER_URL: process.env.SOCKET_SERVER_URL || "http://localhost:4000",
  }
};

export default nextConfig;
