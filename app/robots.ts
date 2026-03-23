/**
 * robots — Dynamic robots.txt generation for search engine crawlers.
 */
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

const BASE_URL = SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/onboarding", "/api"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
