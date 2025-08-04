/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    tsconfigPath: 'tsconfig.web.json',
  },
};

export default nextConfig;
