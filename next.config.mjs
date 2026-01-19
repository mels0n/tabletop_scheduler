/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    experimental: {
        instrumentationHook: false,
    },
    webpack: (config, { webpack }) => {

        return config;
    },
};

export default nextConfig;
