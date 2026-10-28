import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` talks to Postgres with a native socket/TLS stack; bundling it breaks
  // on serverless hosts, so keep it external.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
