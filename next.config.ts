import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/chat": ["./WebNexus_Website_Chatbot_Knowledge_Base.pdf"],
  },
};

export default nextConfig;
