import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.VERCEL_ENV === "preview") return [];
  const origin = process.env.APP_URL || "http://localhost:3000";
  return ["/", "/demo", "/case-study", "/privacy"].map((path) => ({ url: new URL(path, origin).href, lastModified: new Date("2026-10-13T00:00:00Z") }));
}
