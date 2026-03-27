/**
 * ContactPage — Client Component rendering the public /contact page.
 *
 * Displays a hero section, a validated contact form (name, email, interest
 * dropdown, message), a Google reCAPTCHA v3 captcha, and an info sidebar
 * with email/location/social links. On successful submission, the form is
 * replaced with a confirmation message.
 *
 * Uses @tanstack/react-form for field-level state and Zod for per-field
 * validation triggered onBlur. The server action `submitContactForm` is
 * called only after full Zod validation + a valid reCAPTCHA token.
 *
 * This is a Client Component ("use client") because it manages form input
 * state, runs client-side Zod validation, and integrates the reCAPTCHA
 * captcha widget which requires browser APIs.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { useForm } from "@tanstack/react-form";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ChevronDown } from "lucide-react";
import { FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { z } from "zod";
import { Footer } from "@/components/landing/Footer";
import { socials as defaultSocials } from "@/lib/socials";
import { submitContactForm } from "./actions";

gsap.registerPlugin(ScrollTrigger);

const platformIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  Instagram: FaInstagram,
  LinkedIn: FaLinkedinIn,
};

// Zod schema shared between per-field onBlur validators and the final
// onSubmit guard. Each field has its own human-readable error message.
const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().default(""),
  interest: z.string().min(1, "Please select what you're interested in"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const inputClasses =
  "w-full px-4 py-3 bg-surface text-foreground text-sm rounded-lg border border-muted/20 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:border-transparent transition-colors placeholder:text-muted/50";
const errorInputClasses =
  "w-full px-4 py-3 bg-surface text-foreground text-sm rounded-lg border border-error/40 outline-none focus-visible:ring-2 focus-visible:ring-error/50 focus-visible:border-transparent transition-colors placeholder:text-muted/50";
const labelClasses = "text-xs tracking-wide uppercase text-muted mb-2 block";
const errorClasses = "text-xs text-error mt-1.5";

function ContactFAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;

    if (open) {
      gsap.to(content, {
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: "power3.out",
        onComplete: () => setOpen(false),
      });
    } else {
      setOpen(true);
      gsap.set(content, { height: "auto", opacity: 1 });
      const h = content.offsetHeight;
      gsap.fromTo(
        content,
        { height: 0, opacity: 0 },
        { height: h, opacity: 1, duration: 0.3, ease: "power3.out" },
      );
    }
  }, [open]);

  return (
    <div className="border-b border-foreground/10">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors duration-200 pr-4">
          {question}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div ref={contentRef} className="overflow-hidden" style={{ height: 0, opacity: 0 }}>
        <p className="text-sm text-muted leading-relaxed pb-5">{answer}</p>
      </div>
    </div>
  );
}

function ContactFAQ({ entries }: { entries: { question: string; answer: string }[] }) {
  return (
    <>
      {entries.map((item) => (
        <ContactFAQItem key={item.question} question={item.question} answer={item.answer} />
      ))}
    </>
  );
}

export function ContactPage({
  businessName,
  location,
  email,
  footerTagline,
  socialLinks,
  interests,
  faqEntries,
}: {
  businessName?: string;
  location?: string;
  email?: string;
  footerTagline?: string;
  socialLinks?: { platform: string; handle: string; url: string }[];
  interests?: string[];
  faqEntries?: { question: string; answer: string }[];
} = {}) {
  // Transform CMS-sourced social links into the internal {label, href, icon,
  // description} shape the sidebar renders. Resolves platform name to an icon
  // component via the platformIcons lookup, falling back to FaInstagram for
  // unrecognised platforms. Uses hardcoded defaultSocials when no CMS data exists.
  const socials = socialLinks
    ? socialLinks.map((s) => ({
        label: s.handle,
        href: s.url,
        icon: platformIcons[s.platform] ?? FaInstagram,
        description: s.platform,
      }))
    : defaultSocials;
  // Tracks whether the form was successfully submitted so we can swap the
  // form for a "message sent" confirmation view.
  const [submitted, setSubmitted] = useState(false);

  const containerRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const stepsHeaderRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const faqHeaderRef = useRef<HTMLDivElement>(null);
  const faqListRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Hero — entrance animation on mount
      if (heroRef.current) {
        const els = heroRef.current.children;
        gsap.fromTo(
          els,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power3.out" },
        );
      }

      // Form — scroll-triggered
      if (formRef.current) {
        gsap.fromTo(
          formRef.current,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
            scrollTrigger: { trigger: formRef.current, start: "top 85%", once: true },
          },
        );
      }

      // Sidebar — scroll-triggered with delay
      if (sidebarRef.current) {
        gsap.fromTo(
          sidebarRef.current,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            delay: 0.2,
            ease: "power3.out",
            scrollTrigger: { trigger: sidebarRef.current, start: "top 85%", once: true },
          },
        );
      }

      // Steps header
      if (stepsHeaderRef.current) {
        gsap.fromTo(
          stepsHeaderRef.current,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: stepsHeaderRef.current, start: "top 85%", once: true },
          },
        );
      }

      // Step cards — staggered
      if (stepsRef.current) {
        gsap.fromTo(
          stepsRef.current.children,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: "power3.out",
            scrollTrigger: { trigger: stepsRef.current, start: "top 85%", once: true },
          },
        );
      }

      // Book directly callout
      if (calloutRef.current) {
        gsap.fromTo(
          calloutRef.current,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
            scrollTrigger: { trigger: calloutRef.current, start: "top 85%", once: true },
          },
        );
      }

      // FAQ header
      if (faqHeaderRef.current) {
        gsap.fromTo(
          faqHeaderRef.current,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: faqHeaderRef.current, start: "top 85%", once: true },
          },
        );
      }

      // FAQ list
      if (faqListRef.current) {
        gsap.fromTo(
          faqListRef.current,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            delay: 0.2,
            ease: "power3.out",
            scrollTrigger: { trigger: faqListRef.current, start: "top 85%", once: true },
          },
        );
      }
    },
    { scope: containerRef },
  );

  // @tanstack/react-form instance — manages per-field values, touched/dirty
  // state, and submission. Individual fields register onBlur validators
  // (see the <form.Field> blocks below) that run the matching Zod shape
  // check, giving instant feedback without a full-form submit.
  //
  // onSubmit performs a final full-schema safeParse, then calls the
  // `submitContactForm` server action with the validated data + reCAPTCHA
  // token for bot verification.
  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      interest: "",
      message: "",
    } satisfies Record<keyof ContactFormData, string>,
    onSubmit: async ({ value }) => {
      const result = contactSchema.safeParse(value);
      if (!result.success) return;

      await submitContactForm({
        name: `${result.data.firstName} ${result.data.lastName}`,
        email: result.data.email,
        phone: result.data.phone || undefined,
        interest: result.data.interest,
        message: result.data.message,
      });
      setSubmitted(true);
    },
  });

  return (
    <>
      <main id="main-content" className="pt-16" ref={containerRef}>
        {/* Hero */}
        <section className="py-16 md:py-20 px-6">
          <div ref={heroRef} className="mx-auto max-w-5xl text-center">
            <span className="text-xs tracking-widest uppercase text-accent mb-6 block opacity-0">
              Contact
            </span>
            <h1 className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6 opacity-0">
              Let&apos;s create something beautiful.
            </h1>
            <p className="text-base md:text-lg text-muted max-w-xl mx-auto opacity-0">
              Whether you&apos;re booking an appointment, requesting a consultation, or just have a
              question — I&apos;d love to hear from you.
            </p>
          </div>
        </section>

        {/* Form + Info */}
        <section className="pb-24 px-6">
          <div className="mx-auto max-w-7xl rounded-2xl border border-muted/10 bg-surface/30 p-8 md:p-12 grid grid-cols-1 md:grid-cols-5 gap-12 md:gap-16">
            {/* Form */}
            <div ref={formRef} className="md:col-span-3 opacity-0">
              {submitted ? (
                <div className="bg-surface rounded-lg border border-muted/20 p-12 text-center">
                  <p className="text-lg text-foreground mb-2">Message sent.</p>
                  <p className="text-sm text-muted">
                    I&apos;ll get back to you within 24–48 hours. Talk soon!
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                  }}
                  className="flex flex-col gap-5"
                  noValidate
                >
                  {/* First Name + Last Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <form.Field
                      name="firstName"
                      validators={{
                        onBlur: ({ value, fieldApi }) => {
                          if (!fieldApi.state.meta.isDirty) return undefined;
                          const result = contactSchema.shape.firstName.safeParse(value);
                          return result.success ? undefined : result.error.issues[0].message;
                        },
                      }}
                    >
                      {(field) => (
                        <div>
                          <label htmlFor={field.name} className={labelClasses}>
                            First Name *
                          </label>
                          <input
                            id={field.name}
                            type="text"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className={
                              field.state.meta.errors.length > 0 ? errorInputClasses : inputClasses
                            }
                            placeholder="First name"
                            aria-invalid={field.state.meta.errors.length > 0 || undefined}
                            aria-describedby={
                              field.state.meta.errors.length > 0 ? `${field.name}-error` : undefined
                            }
                          />
                          {field.state.meta.errors.length > 0 && (
                            <p id={`${field.name}-error`} className={errorClasses} role="alert">
                              {field.state.meta.errors[0]}
                            </p>
                          )}
                        </div>
                      )}
                    </form.Field>

                    <form.Field
                      name="lastName"
                      validators={{
                        onBlur: ({ value, fieldApi }) => {
                          if (!fieldApi.state.meta.isDirty) return undefined;
                          const result = contactSchema.shape.lastName.safeParse(value);
                          return result.success ? undefined : result.error.issues[0].message;
                        },
                      }}
                    >
                      {(field) => (
                        <div>
                          <label htmlFor={field.name} className={labelClasses}>
                            Last Name *
                          </label>
                          <input
                            id={field.name}
                            type="text"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className={
                              field.state.meta.errors.length > 0 ? errorInputClasses : inputClasses
                            }
                            placeholder="Last name"
                            aria-invalid={field.state.meta.errors.length > 0 || undefined}
                            aria-describedby={
                              field.state.meta.errors.length > 0 ? `${field.name}-error` : undefined
                            }
                          />
                          {field.state.meta.errors.length > 0 && (
                            <p id={`${field.name}-error`} className={errorClasses} role="alert">
                              {field.state.meta.errors[0]}
                            </p>
                          )}
                        </div>
                      )}
                    </form.Field>
                  </div>

                  {/* Email + Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <form.Field
                      name="email"
                      validators={{
                        onBlur: ({ value, fieldApi }) => {
                          if (!fieldApi.state.meta.isDirty) return undefined;
                          const result = contactSchema.shape.email.safeParse(value);
                          return result.success ? undefined : result.error.issues[0].message;
                        },
                      }}
                    >
                      {(field) => (
                        <div>
                          <label htmlFor={field.name} className={labelClasses}>
                            Email *
                          </label>
                          <input
                            id={field.name}
                            type="email"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className={
                              field.state.meta.errors.length > 0 ? errorInputClasses : inputClasses
                            }
                            placeholder="you@email.com"
                            aria-invalid={field.state.meta.errors.length > 0 || undefined}
                            aria-describedby={
                              field.state.meta.errors.length > 0 ? `${field.name}-error` : undefined
                            }
                          />
                          {field.state.meta.errors.length > 0 && (
                            <p id={`${field.name}-error`} className={errorClasses} role="alert">
                              {field.state.meta.errors[0]}
                            </p>
                          )}
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="phone">
                      {(field) => (
                        <div>
                          <label htmlFor={field.name} className={labelClasses}>
                            Phone
                          </label>
                          <input
                            id={field.name}
                            type="tel"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className={inputClasses}
                            placeholder="(555) 123-4567"
                          />
                        </div>
                      )}
                    </form.Field>
                  </div>

                  {/* Interest */}
                  <form.Field
                    name="interest"
                    validators={{
                      onBlur: ({ value, fieldApi }) => {
                        if (!fieldApi.state.meta.isDirty) return undefined;
                        const result = contactSchema.shape.interest.safeParse(value);
                        return result.success ? undefined : result.error.issues[0].message;
                      },
                    }}
                  >
                    {(field) => (
                      <div>
                        <label htmlFor={field.name} className={labelClasses}>
                          I&apos;m interested in *
                        </label>
                        <div className="relative">
                          <select
                            id={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className={
                              field.state.meta.errors.length > 0
                                ? `${errorInputClasses} appearance-none pr-10`
                                : `${inputClasses} appearance-none pr-10`
                            }
                            aria-invalid={field.state.meta.errors.length > 0 || undefined}
                            aria-describedby={
                              field.state.meta.errors.length > 0 ? `${field.name}-error` : undefined
                            }
                          >
                            <option value="" disabled>
                              Select an option
                            </option>
                            {/* Render each interest as a <select> option. The interest
                                string serves as both the display label and the form value. */}
                            {(interests ?? []).map((interest) => (
                              <option key={interest} value={interest}>
                                {interest}
                              </option>
                            ))}
                          </select>
                          <svg
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 6l4 4 4-4"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        {field.state.meta.errors.length > 0 && (
                          <p id={`${field.name}-error`} className={errorClasses} role="alert">
                            {field.state.meta.errors[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>

                  {/* Message */}
                  <form.Field
                    name="message"
                    validators={{
                      onBlur: ({ value, fieldApi }) => {
                        if (!fieldApi.state.meta.isDirty) return undefined;
                        const result = contactSchema.shape.message.safeParse(value);
                        return result.success ? undefined : result.error.issues[0].message;
                      },
                    }}
                  >
                    {(field) => (
                      <div>
                        <label htmlFor={field.name} className={labelClasses}>
                          Message *
                        </label>
                        <textarea
                          id={field.name}
                          rows={5}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          className={`${
                            field.state.meta.errors.length > 0 ? errorInputClasses : inputClasses
                          } resize-none`}
                          placeholder="Tell me about your project or question..."
                          aria-invalid={field.state.meta.errors.length > 0 || undefined}
                          aria-describedby={
                            field.state.meta.errors.length > 0 ? `${field.name}-error` : undefined
                          }
                        />
                        {field.state.meta.errors.length > 0 && (
                          <p id={`${field.name}-error`} className={errorClasses} role="alert">
                            {field.state.meta.errors[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>

                  <form.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="self-start px-8 py-3.5 text-xs tracking-wide uppercase bg-foreground text-background rounded-full hover:bg-foreground/80 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? "Sending..." : "Send Message"}
                      </button>
                    )}
                  </form.Subscribe>
                </form>
              )}
            </div>

            {/* Info sidebar */}
            <div ref={sidebarRef} className="md:col-span-2 flex flex-col gap-8 opacity-0">
              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">Email</h3>
                <a
                  href={`mailto:${email ?? "hello@tcreativestudio.com"}`}
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  {email ?? "hello@tcreativestudio.com"}
                </a>
              </div>

              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">Location</h3>
                <p className="text-sm text-muted">{location ?? "San Jose, California"}</p>
                <p className="text-xs text-muted mt-1">Serving the Bay Area</p>
              </div>

              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">
                  Response Time
                </h3>
                <p className="text-sm text-muted">Typically within 24–48 hours</p>
              </div>

              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">
                  Follow Along
                </h3>
                <div className="flex flex-col gap-2.5">
                  {/* Render each social link with its platform icon and handle text.
                      Opens in a new tab with noopener for security. */}
                  {socials.map((s) => {
                    const Icon = s.icon;
                    return (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 text-sm text-muted hover:text-foreground transition-colors"
                      >
                        <Icon size={14} className="flex-shrink-0" />
                        <span>
                          {s.label}
                          {s.description && (
                            <span className="text-muted/60 ml-1.5 text-xs">
                              &middot; {s.description}
                            </span>
                          )}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What happens next */}
        <section className="pb-24 md:pb-32 px-6" aria-label="What happens next">
          <div className="mx-auto max-w-7xl">
            <div ref={stepsHeaderRef} className="text-center mb-14 opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                What Happens Next
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                Simple as 1, 2, 3.
              </h2>
            </div>

            <div ref={stepsRef} className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              {[
                {
                  number: "01",
                  title: "You reach out",
                  description:
                    "Fill out the form above with your details. Tell me what you're interested in — no commitment required.",
                },
                {
                  number: "02",
                  title: "I respond within 24–48 hrs",
                  description:
                    "I'll review your inquiry and follow up with availability, pricing, and any questions.",
                },
                {
                  number: "03",
                  title: "We book your appointment",
                  description:
                    "Once we've confirmed the details, I'll send you a booking link to lock in your spot.",
                },
              ].map((step) => (
                <div key={step.number} className="text-center opacity-0">
                  <span className="text-4xl font-light text-accent/20 block mb-3">
                    {step.number}
                  </span>
                  <h3 className="text-base font-medium text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted leading-relaxed max-w-[260px] mx-auto">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Book directly callout */}
        <section className="pb-24 md:pb-32 px-6">
          <div
            ref={calloutRef}
            className="mx-auto max-w-7xl rounded-2xl bg-foreground text-background p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-6 opacity-0"
          >
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-tight mb-2">
                Already know what you want?
              </h2>
              <p className="text-sm text-background/60">
                Skip the form and browse services, pricing, and availability directly.
              </p>
            </div>
            <Link
              href="/services"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 text-xs tracking-wide uppercase rounded-full bg-background text-foreground hover:bg-background/90 transition-colors"
            >
              View Services
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-28 md:pb-40 px-6" aria-label="FAQ">
          <div className="mx-auto max-w-3xl">
            <div ref={faqHeaderRef} className="text-center mb-12 md:mb-16 opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-4 block">FAQ</span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                Common questions.
              </h2>
            </div>

            <div ref={faqListRef} className="opacity-0">
              <ContactFAQ entries={faqEntries ?? []} />
            </div>
          </div>
        </section>
      </main>
      <Footer
        businessName={businessName}
        location={location}
        email={email}
        tagline={footerTagline}
        socialLinks={socialLinks}
      />
    </>
  );
}
