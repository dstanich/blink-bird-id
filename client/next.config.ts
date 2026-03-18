import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Enable static export, we are going to serve the files from S3
  trailingSlash: true,
};

export default nextConfig;
