import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { generateOgImage, ogImageSize } from "@/lib/generate-og-image";

export const runtime = "nodejs";
export const alt = "Services — Lash Extensions, Permanent Jewelry & More";
export const size = ogImageSize;
export const contentType = "image/png";

export default async function Image() {
  const business = await getPublicBusinessProfile();
  return generateOgImage({
    businessName: business.businessName,
    title: "Our Services",
    subtitle: "Lash extensions, permanent jewelry, custom crochet & consulting",
  });
}
