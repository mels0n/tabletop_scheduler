/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    experimental: {
        instrumentationHook: true,
    },
    webpack: (config, { webpack }) => {
        if (process.env.IS_DOCKER_BUILD === 'true') {
            config.resolve.alias['@/components/GoogleAdBar'] = '@/components/NoOp';
            config.resolve.alias['@/components/GoogleAnalytics'] = '@/components/NoOp';
        }
        return config;
    },
};

export default nextConfig;
