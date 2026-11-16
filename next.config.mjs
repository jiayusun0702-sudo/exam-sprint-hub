/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@anthropic-ai/sdk"],
  // The publish route reads the site template from disk.
  outputFileTracingIncludes: { "/api/publish": ["./public/site-template.html"] },
};
export default nextConfig;
