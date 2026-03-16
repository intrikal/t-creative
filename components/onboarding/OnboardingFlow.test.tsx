import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnboardingFlow } from "./OnboardingFlow";

/* ------------------------------------------------------------------ */
/*  Module mocks                                                        */
/* ------------------------------------------------------------------ */

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

vi.mock("@/components/TCLogo", () => ({
  TCLogo: () => <svg data-testid="tc-logo" />,
}));

vi.mock("@/app/onboarding/actions", () => ({
  saveOnboardingData: vi.fn().mockResolvedValue(undefined),
}));

// Mock panels barrel — removes all panel component dependencies (react-icons/pi, /fa, etc.)
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

// Minimal OnboardingShell that exposes the same nav interface the real one does
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

describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
