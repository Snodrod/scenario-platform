import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist (used by pdf-parse) resolves its worker file relative to
  // its own module location at runtime — bundling it breaks that lookup
  // ("Cannot find module .../pdf.worker.mjs"). Keep it (and mammoth, same
  // class of issue) on native Node `require` instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth"],
};

export default nextConfig;
