/**
 * panels/index.ts — Barrel export for all onboarding right-side panel components.
 *
 * Each panel is the decorative right-side (desktop) / top (mobile) companion that
 * displays alongside its corresponding left-side step form inside OnboardingShell.
 * Panels are purely presentational — they receive live form values via
 * `form.Subscribe` in OnboardingFlow.tsx and re-render only when those values change.
 *
 * Panels are grouped by flow:
 * - Client flow:   PanelName, PanelInterests, PanelAllergies, PanelContact,
 *                  PanelWaiver, PanelRewards, PanelPreferences, PanelPhotoConsent
 * - Assistant flow: PanelRoleSkills, PanelShiftAvailability, PanelEmergencyContact,
 *                   PanelContactPrefs, PanelAssistantPortfolio, PanelAssistantPolicies
 * - Admin flow:    PanelAdminWelcome, PanelAdminContact, PanelAdminSocials,
 *                  PanelAdminStudio, PanelAdminServices, PanelAdminHours,
 *                  PanelAdminIntake, PanelAdminPolicies, PanelAdminRewards,
 *                  PanelAdminComplete
 *
 * This barrel keeps OnboardingFlow.tsx's import section to a single line instead
 * of one import per panel file.
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx — sole consumer of these exports
 * - components/onboarding/OnboardingShell.tsx — renders the panel slot
 */
export { PanelName } from "./PanelName";
export { PanelInterests } from "./PanelInterests";
export { PanelAllergies } from "./PanelAllergies";
export { PanelContact } from "./PanelContact";
export { PanelWaiver } from "./PanelWaiver";
export { PanelPhotoConsent } from "./PanelPhotoConsent";
export { PanelRoleSkills } from "./PanelRoleSkills";
export { PanelShiftAvailability } from "./PanelShiftAvailability";
export { PanelEmergencyContact } from "./PanelEmergencyContact";
export { PanelContactPrefs } from "./PanelContactPrefs";
export { PanelAdminWelcome } from "./PanelAdminWelcome";
export { PanelAdminContact } from "./PanelAdminContact";
export { PanelAdminSocials } from "./PanelAdminSocials";
export { PanelAdminStudio } from "./PanelAdminStudio";
export { PanelAdminComplete } from "./PanelAdminComplete";
export { PanelAdminServices } from "./PanelAdminServices";
export { PanelAdminHours } from "./PanelAdminHours";
export { PanelAdminIntake } from "./PanelAdminIntake";
export { PanelAdminPolicies } from "./PanelAdminPolicies";
export { PanelAdminRewards } from "./PanelAdminRewards";
export { PanelAssistantPortfolio } from "./PanelAssistantPortfolio";
export { PanelAssistantPolicies } from "./PanelAssistantPolicies";
export { PanelRewards } from "./PanelRewards";
export { PanelPreferences } from "./PanelPreferences";
