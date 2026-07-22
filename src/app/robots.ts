import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo-utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin-login", "/api", "/appointment"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
  };
}
