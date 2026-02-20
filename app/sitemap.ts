/**
 * sitemap — Dynamic sitemap generation listing all public routes.
 */
import type { MetadataRoute } from "next";

const BASE_URL = "https://tcreativestudio.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/services", "/portfolio", "/training", "/consulting", "/about", "/contact"];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1.0 : 0.8,
  }));
}
