import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { generateOgImage, ogImageSize } from "@/lib/generate-og-image";

export const runtime = "nodejs";
export const alt = "HR & Business Consulting";
export const size = ogImageSize;
export const contentType = "image/png";

export default async function Image() {
  const business = await getPublicBusinessProfile();
  return generateOgImage({
    businessName: business.businessName,
    title: "HR & Business Consulting",
    subtitle: "Strategic consulting for entrepreneurs and growing companies",
  });
}
