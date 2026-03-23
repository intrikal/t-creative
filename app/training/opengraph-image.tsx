import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { generateOgImage, ogImageSize } from "@/lib/generate-og-image";

export const runtime = "nodejs";
export const alt = "Training Programs — Certification Courses";
export const size = ogImageSize;
export const contentType = "image/png";

export default async function Image() {
  const business = await getPublicBusinessProfile();
  return generateOgImage({
    businessName: business.businessName,
    title: "Training Programs",
    subtitle: "Lash extension & permanent jewelry certification courses",
    category: "Professional Certification",
  });
}
