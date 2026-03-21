import { getCurrentUser } from "@/lib/auth";
import { getAdminSetupData } from "../admin-setup-data";
import { SetupBannerWrapper } from "../components/AdminSetupBannerWrapper";

export async function AdminSetupSection() {
  const user = await getCurrentUser();
  if (!user) return null;

  const setupData = await getAdminSetupData(user.id);

  // If all setup items are done, don't render anything
  const complete =
    !!setupData.studioName &&
    !!setupData.locationArea &&
    setupData.socialCount > 0 &&
    setupData.hasPolicies &&
    setupData.hasDeposits;
  if (complete) return null;

  function toSlug(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, "") || "tcreativestudio";
  }

  const setup = {
    studioName: setupData.studioName,
    locationArea: setupData.locationArea,
    socialCount: setupData.socialCount,
    hasPolicies: setupData.hasPolicies,
    hasDeposits: setupData.hasDeposits,
  };

  return (
    <SetupBannerWrapper
      setup={setup}
      bookingSlug={toSlug(setupData.studioName ?? "")}
    />
  );
}
