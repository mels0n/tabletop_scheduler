/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    experimental: {
        instrumentationHook: true,
    },
    webpack: (config, { webpack }) => {

        return config;
    },
};

export default nextConfig;
