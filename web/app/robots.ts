import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === "preview") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/login", "/signup", "/onboarding", "/auth/", "/reset-password", "/forgot-password"] }, sitemap: new URL("/sitemap.xml", process.env.APP_URL || "http://localhost:3000").href };
}
