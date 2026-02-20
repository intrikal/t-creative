/**
 * panels/index.ts — Barrel export for all onboarding panel components
 *
 * What: Re-exports every panel from its own file so other files can import
 *       them all from one path: `import { PanelName, PanelInterests } from "./panels"`.
 * Why: Keeps imports clean in OnboardingFlow.tsx. Without this, you'd need
 *      separate import lines — one per panel file.
 *
 * Key concept:
 * - `export { PanelName } from "./PanelName"` re-exports the named export
 *   directly. The importing file never needs to know the internal file structure.
 */
export { PanelName } from "./PanelName";
export { PanelInterests } from "./PanelInterests";
export { PanelAllergies } from "./PanelAllergies";
export { PanelContact } from "./PanelContact";
export { PanelWaiver } from "./PanelWaiver";
export { PanelPhotoConsent } from "./PanelPhotoConsent";
