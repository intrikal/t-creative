/**
 * robots — Dynamic robots.txt generation for search engine crawlers.
 */
import type { MetadataRoute } from "next";

const BASE_URL = "https://tcreativestudio.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
