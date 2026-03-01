/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@lmnr-ai/lmnr", "esbuild"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("@lmnr-ai/lmnr");
    }
    return config;
  },
};

export default nextConfig;
