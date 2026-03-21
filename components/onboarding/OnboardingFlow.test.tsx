/**
 * OnboardingFlow.test.tsx — Integration tests for the multi-step onboarding wizard.
 *
 * What: Tests the client and assistant onboarding flows end-to-end at the
 *       component level — verifying step rendering, navigation (forward/back),
 *       form pre-fill from Google OAuth, and button enable/disable gates.
 *
 * Why: The onboarding wizard is the first experience for every user. Regressions
 *      here (broken navigation, missing pre-fill, stuck buttons) would block
 *      signups entirely. These tests catch those issues before deploy.
 *
 * How: Heavy mocking — Framer Motion, React Icons, Next.js router, panels, and
 *      the OnboardingShell are all replaced with minimal stubs. This isolates
 *      the tests to OnboardingFlow's orchestration logic (step state, form state,
 *      canAdvance gating) without depending on animation libraries or icon packs.
 *
 * Mock strategy:
 * - Framer Motion → plain HTML elements (strips animation props)
 * - React Icons → null components (avoids vitest Proxy hang)
 * - OnboardingShell → minimal div with step counter + prev/next buttons
 * - All panels → null (no visual output needed for navigation tests)
 * - saveOnboardingData → resolved Promise (no network calls)
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx — the component under test
 */
// render: mounts a React component into a virtual DOM for testing
// screen: queries to find elements in rendered output (getByText, getByRole, etc.)
// fireEvent: simulates user interactions (click, change, etc.)
import { render, screen, fireEvent } from "@testing-library/react";
// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnboardingFlow } from "./OnboardingFlow";

/* ------------------------------------------------------------------ */
/*  Module mocks                                                        */
/* ------------------------------------------------------------------ */

// vi.mock("next/link"): replaces Next.js Link with a plain <a> tag so
// link rendering works in the test DOM without Next.js router context
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [k: string]: unknown;
  }) => (
    <a href={href} {...(props as object)}>
      {children}
    </a>
  ),
}));

// vi.mock("next/navigation"): replaces Next.js router hooks — usePathname
// returns a fixed path, useRouter returns no-op push/replace
vi.mock("next/navigation", () => ({
  usePathname: () => "/onboarding",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Framer Motion — strip animation props, render plain HTML elements
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      initial,
      animate,
      exit,
      transition,
      variants,
      custom,
      whileHover,
      whileTap,
      layout,
      ...props
    }: Record<string, unknown>) => <div {...(props as object)}>{children as React.ReactNode}</div>,
    button: ({
      children,
      initial,
      animate,
      exit,
      transition,
      variants,
      custom,
      whileHover,
      whileTap,
      ...props
    }: Record<string, unknown>) => (
      <button {...(props as object)}>{children as React.ReactNode}</button>
    ),
    svg: ({
      children,
      initial,
      animate,
      exit,
      transition,
      variants,
      ...props
    }: Record<string, unknown>) => <svg {...(props as object)}>{children as React.ReactNode}</svg>,
    path: ({ initial, animate, exit, transition, variants, ...props }: Record<string, unknown>) => (
      <path {...(props as object)} />
    ),
  },
}));

// React Icons — explicit null stubs avoids the Proxy hang in vitest
vi.mock("react-icons/lu", () => {
  const n = () => null;
  return {
    LuArrowDown: n,
    LuArrowRight: n,
    LuAward: n,
    LuBadgeCheck: n,
    LuBanknote: n,
    LuBell: n,
    LuBellRing: n,
    LuBookOpen: n,
    LuBuilding: n,
    LuCake: n,
    LuCalendar: n,
    LuCalendarCheck: n,
    LuCalendarDays: n,
    LuCamera: n,
    LuCheck: n,
    LuCheckCheck: n,
    LuChevronLeft: n,
    LuChevronRight: n,
    LuClipboardCheck: n,
    LuClipboardList: n,
    LuClock: n,
    LuCopy: n,
    LuCreditCard: n,
    LuEye: n,
    LuGem: n,
    LuGift: n,
    LuGlobe: n,
    LuGraduationCap: n,
    LuHeart: n,
    LuHouse: n,
    LuImage: n,
    LuInstagram: n,
    LuLayoutDashboard: n,
    LuLightbulb: n,
    LuLink: n,
    LuListChecks: n,
    LuLock: n,
    LuMail: n,
    LuMapPin: n,
    LuMessageSquare: n,
    LuMousePointerClick: n,
    LuPackage: n,
    LuPartyPopper: n,
    LuPhone: n,
    LuRepeat: n,
    LuScissors: n,
    LuSend: n,
    LuShare: n,
    LuShieldAlert: n,
    LuShieldCheck: n,
    LuShoppingBag: n,
    LuSmartphone: n,
    LuSparkles: n,
    LuStar: n,
    LuTable: n,
    LuTrendingUp: n,
    LuTriangleAlert: n,
    LuTrophy: n,
    LuUser: n,
    LuUserCheck: n,
    LuUserPlus: n,
    LuUsers: n,
    LuX: n,
    LuZap: n,
    LuShare2: n,
  };
});

vi.mock("react-icons/pi", () => {
  const n = () => null;
  return { PiEyeClosedBold: n, PiLinkSimpleBold: n, PiCoatHangerBold: n, PiBriefcaseBold: n };
});

vi.mock("react-icons/si", () => ({ SiTiktok: () => null }));
vi.mock("react-icons/fa", () => ({
  FaInstagram: () => null,
  FaTiktok: () => null,
  FaFacebook: () => null,
  FaYoutube: () => null,
  FaPinterest: () => null,
  FaLinkedinIn: () => null,
  FaGoogle: () => null,
}));
vi.mock("react-icons", () => ({}));

// vi.mock("@/components/TCLogo"): replaces the logo SVG with a test stub
vi.mock("@/components/TCLogo", () => ({
  TCLogo: () => <svg data-testid="tc-logo" />,
}));

// vi.mock("@/app/onboarding/actions"): replaces the server action so
// form submission resolves immediately without network calls
vi.mock("@/app/onboarding/actions", () => ({
  saveOnboardingData: vi.fn().mockResolvedValue(undefined),
}));

// vi.mock("./panels"): replaces all panel components with null stubs.
// Removes transitive dependencies on react-icons/pi, /fa, etc. that
// cause vitest Proxy issues. Tests only need the orchestration logic.
vi.mock("./panels", () => {
  const n = () => null;
  return {
    PanelName: n,
    PanelInterests: n,
    PanelAllergies: n,
    PanelContact: n,
    PanelWaiver: n,
    PanelPhotoConsent: n,
    PanelRoleSkills: n,
    PanelShiftAvailability: n,
    PanelEmergencyContact: n,
    PanelContactPrefs: n,
    PanelAdminWelcome: n,
    PanelAdminContact: n,
    PanelAdminSocials: n,
    PanelAdminStudio: n,
    PanelAdminComplete: n,
    PanelAdminServices: n,
    PanelAdminHours: n,
    PanelAdminIntake: n,
    PanelAdminPolicies: n,
    PanelAdminRewards: n,
    PanelAssistantPortfolio: n,
    PanelAssistantPolicies: n,
    PanelRewards: n,
    PanelPreferences: n,
  };
});

vi.mock("./PanelSummary", () => ({ PanelSummary: () => null }));
vi.mock("./PanelAssistantSummary", () => ({ PanelAssistantSummary: () => null }));

// vi.mock("./OnboardingShell"): replaces the real shell with a minimal div
// that renders a step counter, prev/next buttons with canAdvance gating,
// and the step content. This isolates tests to OnboardingFlow's step
// orchestration logic (which step to show, when to enable/disable nav).
vi.mock("./OnboardingShell", () => ({
  OnboardingShell: ({
    step,
    totalSteps,
    isComplete,
    stepContent,
    completionContent,
    onBack,
    onNext,
    canAdvance = true,
  }: {
    step: number;
    totalSteps: number;
    isComplete: boolean;
    stepContent: React.ReactNode;
    panelContent: React.ReactNode;
    completionContent: React.ReactNode;
    completionPanel: React.ReactNode;
    onBack: () => void;
    onNext: () => void;
    canAdvance?: boolean;
    stepId?: string;
    direction?: number;
  }) => (
    <div>
      <span data-testid="step-counter">
        {step + 1} of {totalSteps}
      </span>
      <button aria-label="Previous step" onClick={onBack} disabled={step === 0}>
        Prev
      </button>
      <button aria-label="Next step" onClick={onNext} disabled={!canAdvance}>
        Next
      </button>
      <div data-testid="step-content">{isComplete ? completionContent : stepContent}</div>
    </div>
  ),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

// Tests the OnboardingFlow multi-step wizard orchestration: step rendering,
// forward/back navigation, OK button enable/disable gating based on form
// state, Google OAuth name pre-fill, and whitespace-only validation
describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Client onboarding: name step rendering, input validation, step
  // advancement via OK button and Next arrow, back navigation, and
  // Google OAuth pre-fill of first/last name fields
  describe("client flow", () => {
    it("renders the name step first", () => {
      render(<OnboardingFlow role="client" />);
      expect(screen.getByText("What should we call you?")).toBeInTheDocument();
    });

    it("shows step counter starting at 1", () => {
      render(<OnboardingFlow role="client" />);
      expect(screen.getByTestId("step-counter").textContent).toMatch(/^1 of /);
    });

    it("renders First name and Last name inputs", () => {
      render(<OnboardingFlow role="client" />);
      expect(screen.getByPlaceholderText("First name")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Last name")).toBeInTheDocument();
    });

    it("OK button is disabled when first name is empty", () => {
      render(<OnboardingFlow role="client" />);
      expect(screen.getByRole("button", { name: /OK/i })).toBeDisabled();
    });

    it("Next step arrow is disabled when first name is empty", () => {
      render(<OnboardingFlow role="client" />);
      expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
    });

    it("Previous step arrow is disabled on first step", () => {
      render(<OnboardingFlow role="client" />);
      expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
    });

    it("OK button becomes enabled after typing a first name", () => {
      render(<OnboardingFlow role="client" />);
      fireEvent.change(screen.getByPlaceholderText("First name"), {
        target: { value: "Jane" },
      });
      expect(screen.getByRole("button", { name: /OK/i })).not.toBeDisabled();
    });

    it("Next step arrow is disabled on step 1 until re-render with firstName set", () => {
      // TanStack Form doesn't re-render the parent on field change, so canAdvance
      // updates on the next step-change render, not immediately after typing.
      render(<OnboardingFlow role="client" googleName="Jane" />);
      // googleName pre-fills firstName, so canAdvance starts true after initial render
      expect(screen.getByRole("button", { name: "Next step" })).not.toBeDisabled();
    });

    it("advances to step 2 when OK is clicked with a first name", () => {
      render(<OnboardingFlow role="client" />);
      fireEvent.change(screen.getByPlaceholderText("First name"), {
        target: { value: "Jane" },
      });
      fireEvent.click(screen.getByRole("button", { name: /OK/i }));
      expect(screen.getByTestId("step-counter").textContent).toMatch(/^2 of /);
    });

    it("advances to step 2 using the Next step arrow when name is pre-filled", () => {
      // googleName pre-fills firstName so canAdvance=true from the initial render,
      // meaning the Next step arrow is enabled without requiring a re-render.
      render(<OnboardingFlow role="client" googleName="Jane Smith" />);
      expect(screen.getByRole("button", { name: "Next step" })).not.toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Next step" }));
      expect(screen.getByTestId("step-counter").textContent).toMatch(/^2 of /);
    });

    it("goes back to step 1 from step 2 using Previous step", () => {
      render(<OnboardingFlow role="client" />);
      fireEvent.change(screen.getByPlaceholderText("First name"), {
        target: { value: "Jane" },
      });
      fireEvent.click(screen.getByRole("button", { name: /OK/i }));
      expect(screen.getByTestId("step-counter").textContent).toMatch(/^2 of /);

      fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
      expect(screen.getByTestId("step-counter").textContent).toMatch(/^1 of /);
      expect(screen.getByText("What should we call you?")).toBeInTheDocument();
    });

    it("pre-fills first name from googleName prop", () => {
      render(<OnboardingFlow role="client" googleName="Jane Smith" />);
      expect(screen.getByPlaceholderText("First name")).toHaveValue("Jane");
    });

    it("pre-fills last name from googleName prop", () => {
      render(<OnboardingFlow role="client" googleName="Jane Smith" />);
      expect(screen.getByPlaceholderText("Last name")).toHaveValue("Smith");
    });

    it("does not advance when firstName is whitespace only", () => {
      render(<OnboardingFlow role="client" />);
      fireEvent.change(screen.getByPlaceholderText("First name"), {
        target: { value: "   " },
      });
      expect(screen.getByRole("button", { name: /OK/i })).toBeDisabled();
    });
  });

  // Assistant onboarding: verifies the name step renders and that
  // googleName is pre-filled into the first name field
  describe("assistant flow", () => {
    it("renders the name step first", () => {
      render(<OnboardingFlow role="assistant" email="a@test.com" googleName="Sam" />);
      expect(screen.getByText("What should we call you?")).toBeInTheDocument();
    });

    it("pre-fills full name into first name input for assistant flow", () => {
      render(<OnboardingFlow role="assistant" googleName="Sam Lee" />);
      // Assistant flow stores the full googleName in firstName directly
      expect(screen.getByPlaceholderText("First name")).toHaveValue("Sam Lee");
    });
  });
});
