/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Transpile monaco-editor for static export compatibility
  transpilePackages: ['monaco-editor'],
  webpack: (config, { isServer }) => {
    // Monaco editor workers — these must be separate chunks for the worker URLs to resolve
    // In static export mode we point Monaco at the copied /monaco/vs assets
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }

    // Suppress the "Critical dependency: the request of a dependency is an expression"
    // warning from monaco-editor's dynamic require() calls
    config.module = config.module ?? {};
    config.module.exprContextCritical = false;

    return config;
  },
};

module.exports = nextConfig;
