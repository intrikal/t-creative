"use client";

/**
 * PanelAdminIntake — the right-panel for step 7 (admin intake step).
 *
 * ## Purpose
 * Previews the intake experience a client will see after booking — specifically
 * the prep instructions and intake questions for each enabled service. Reinforces
 * to the admin that their configuration is real and automatically sent to clients.
 *
 * ## Behavior
 * - Only renders intake sections for **enabled** services (filtered from the
 *   `services` prop). If none are enabled, shows a placeholder message.
 * - For each enabled service, shows:
 *   - A send icon + prep text (or "No prep set yet" if empty)
 *   - A clipboard icon + list of the enabled intake question labels
 * - If no questions are checked for a service, that section is omitted.
 *
 * ## Why this mirrors StepAdminIntake
 * The panel renders with live `intake` values from the form, so changes in
 * StepAdminIntake (toggling questions, editing prep text) update this preview
 * in real-time.
 *
 * ## Props
 * @prop services - which services are enabled (used to filter visible sections)
 * @prop intake - the full intake object from the form, containing prep text and
 *   boolean question flags for each service (lash, jewelry, crochet, consulting)
 */
import { motion } from "framer-motion";
import { LuEye, LuGem, LuScissors, LuLightbulb, LuSend, LuClipboardList } from "react-icons/lu";
import { fadeUp, stagger } from "./shared";

interface ServiceIntake {
  prep: string;
  [key: string]: boolean | string;
}

interface Props {
  services: {
    lash: { enabled: boolean };
    jewelry: { enabled: boolean };
    crochet: { enabled: boolean };
    consulting: { enabled: boolean };
  };
  intake: {
    lash: ServiceIntake;
    jewelry: ServiceIntake;
    crochet: ServiceIntake;
    consulting: ServiceIntake;
  };
}

const SERVICE_META = [
  {
    key: "lash" as const,
    name: "Lash Extensions",
    icon: LuEye,
    color: "text-rose-400",
    bg: "bg-rose-400/12",
    questionLabels: {
      adhesiveAllergy: "Adhesive or latex allergies?",
      contactLenses: "Contact lens wearer?",
      previousLashes: "Previous lash experience?",
      desiredLook: "Desired look?",
    },
  },
  {
    key: "jewelry" as const,
    name: "Permanent Jewelry",
    icon: LuGem,
    color: "text-amber-400",
    bg: "bg-amber-400/12",
    questionLabels: {
      metalAllergy: "Metal or nickel allergies?",
      designPreference: "Chain style or design?",
    },
  },
  {
    key: "crochet" as const,
    name: "Crochet",
    icon: LuScissors,
    color: "text-violet-400",
    bg: "bg-violet-400/12",
    questionLabels: {
      hairType: "Hair type / texture?",
      desiredStyle: "Style, length, color?",
      scalpSensitivity: "Scalp sensitivities?",
    },
  },
  {
    key: "consulting" as const,
    name: "Consulting",
    icon: LuLightbulb,
    color: "text-teal-400",
    bg: "bg-teal-400/12",
    questionLabels: {
      serviceInterest: "Services you're considering?",
      previousExperience: "Done this before?",
      goal: "Goal or vision?",
    },
  },
];

export function PanelAdminIntake({ services, intake }: Props) {
  const enabledServices = SERVICE_META.filter((s) => services[s.key]?.enabled);

  return (
    <div className="flex flex-col justify-center h-full px-6 py-5">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-[380px] space-y-2.5"
      >
        {/* Header */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-accent uppercase tracking-[0.15em] mb-0.5">
            Client experience
          </p>
          <h2 className="text-lg font-semibold text-foreground leading-tight">What clients see.</h2>
          <p className="text-xs text-muted/60 mt-0.5 leading-snug">
            Prep sends after booking. Questions fill out at checkout — all automatic.
          </p>
        </motion.div>

        {enabledServices.length === 0 ? (
          <motion.div variants={fadeUp}>
            <p className="text-sm text-muted/40 italic">Enable services to preview intake.</p>
          </motion.div>
        ) : (
          enabledServices.map(({ key, name, icon: Icon, color, bg, questionLabels }) => {
            const serviceIntake = intake[key];
            const activeQuestions = Object.entries(questionLabels).filter(
              ([qKey]) => serviceIntake[qKey] === true,
            );
            const hasPrep = !!serviceIntake.prep;

            return (
              <motion.div key={key} variants={fadeUp} className="space-y-1">
                {/* Service header */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-4 h-4 rounded-md ${bg} flex items-center justify-center shrink-0`}
                  >
                    <Icon className={color} style={{ width: 8, height: 8 }} />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground/70">{name}</span>
                </div>

                <div className="ml-5.5 space-y-1 pl-0.5">
                  {/* Prep row */}
                  <div className="flex items-start gap-1.5">
                    <LuSend className="w-2.5 h-2.5 text-accent/50 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-foreground/50 leading-snug">
                      {hasPrep ? (
                        serviceIntake.prep
                      ) : (
                        <span className="italic text-muted/30">No prep set yet</span>
                      )}
                    </p>
                  </div>

                  {/* Questions */}
                  {activeQuestions.length > 0 && (
                    <div className="flex items-start gap-1.5">
                      <LuClipboardList className="w-2.5 h-2.5 text-foreground/25 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        {activeQuestions.map(([, label]) => (
                          <p key={label} className="text-[11px] text-foreground/45 leading-snug">
                            {label}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}
