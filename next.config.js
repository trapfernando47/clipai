/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  turbopack: {},
  serverExternalPackages: ["fluent-ffmpeg", "ffmpeg-static", "ytdl-core"],
};

module.exports = nextConfig;
