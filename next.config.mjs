/** @type {import('next').NextConfig} */
const nextConfig = {
    output: process.env.IS_DOCKER_BUILD === 'true' ? 'standalone' : undefined,
    experimental: {
        instrumentationHook: true,
    },
    webpack: (config, { webpack }) => {

        return config;
    },
};

export default nextConfig;
