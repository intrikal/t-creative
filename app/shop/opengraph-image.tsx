import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { generateOgImage, ogImageSize } from "@/lib/generate-og-image";

export const runtime = "nodejs";
export const alt = "Shop — Aftercare Products & Studio Merch";
export const size = ogImageSize;
export const contentType = "image/png";

export default async function Image() {
  const business = await getPublicBusinessProfile();
  return generateOgImage({
    businessName: business.businessName,
    title: "Shop",
    subtitle: "Aftercare products, permanent jewelry & studio merch",
  });
}
