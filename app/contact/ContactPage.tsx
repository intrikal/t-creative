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

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { m } from "framer-motion";
import { FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { z } from "zod";
import { Footer } from "@/components/landing/Footer";
import { socials as defaultSocials } from "@/lib/socials";
import { submitContactForm } from "./actions";

const platformIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  Instagram: FaInstagram,
  LinkedIn: FaLinkedinIn,
};

// Zod schema shared between per-field onBlur validators and the final
// onSubmit guard. Each field has its own human-readable error message.
const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  interest: z.string().min(1, "Please select what you're interested in"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const interests = [
  "Lash Extensions",
  "Permanent Jewelry",
  "Crochet Hair Install",
  "Custom Crochet Crafts",
  "Beauty Business Consulting",
  "HR Consulting",
  "Training Programs",
  "Shop Products",
  "Other",
];

const inputClasses =
  "w-full px-4 py-3 bg-surface text-foreground text-sm border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors";
const errorInputClasses =
  "w-full px-4 py-3 bg-surface text-foreground text-sm border border-error/40 outline-none focus-visible:ring-2 focus-visible:ring-error/50 transition-colors";
const labelClasses = "text-xs tracking-wide uppercase text-muted mb-2 block";
const errorClasses = "text-xs text-error mt-1.5";

export function ContactPage({
  businessName,
  location,
  email,
  footerTagline,
  socialLinks,
}: {
  businessName?: string;
  location?: string;
  email?: string;
  footerTagline?: string;
  socialLinks?: { platform: string; handle: string; url: string }[];
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
      name: "",
      email: "",
      interest: "",
      message: "",
    } as ContactFormData,
    onSubmit: async ({ value }) => {
      const result = contactSchema.safeParse(value);
      if (!result.success) return;

      await submitContactForm(result.data);
      setSubmitted(true);
    },
  });

  return (
    <>
      <main id="main-content" className="pt-16">
        {/* Hero */}
        <section className="py-24 md:py-32 px-6">
          <div className="mx-auto max-w-5xl text-center">
            <m.span
              className="text-xs tracking-widest uppercase text-muted mb-6 block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Contact
            </m.span>
            <m.h1
              className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Let&apos;s create something beautiful.
            </m.h1>
            <m.p
              className="text-base md:text-lg text-muted max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Whether you&apos;re booking an appointment, requesting a consultation, or just have a
              question — I&apos;d love to hear from you.
            </m.p>
          </div>
        </section>

        {/* Form + Info */}
        <section className="pb-32 px-6">
          <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-5 gap-12 md:gap-16">
            {/* Form */}
            <m.div
              className="md:col-span-3"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              {submitted ? (
                <div className="bg-surface p-12 text-center">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Name */}
                    <form.Field
                      name="name"
                      validators={{
                        onBlur: ({ value }) => {
                          const result = contactSchema.shape.name.safeParse(value);
                          return result.success ? undefined : result.error.issues[0].message;
                        },
                      }}
                    >
                      {(field) => (
                        <div>
                          <label htmlFor={field.name} className={labelClasses}>
                            Full Name *
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
                            placeholder="Your name"
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

                    {/* Email */}
                    <form.Field
                      name="email"
                      validators={{
                        onBlur: ({ value }) => {
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
                  </div>

                  {/* Interest */}
                  <form.Field
                    name="interest"
                    validators={{
                      onBlur: ({ value }) => {
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
                        <select
                          id={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          className={
                            field.state.meta.errors.length > 0
                              ? `${errorInputClasses} appearance-none`
                              : `${inputClasses} appearance-none`
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
                          {interests.map((interest) => (
                            <option key={interest} value={interest}>
                              {interest}
                            </option>
                          ))}
                        </select>
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
                      onBlur: ({ value }) => {
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
                        className="self-start px-8 py-3.5 text-xs tracking-wide uppercase bg-foreground text-background hover:bg-muted transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? "Sending..." : "Send Message"}
                      </button>
                    )}
                  </form.Subscribe>
                </form>
              )}
            </m.div>

            {/* Info sidebar */}
            <m.div
              className="md:col-span-2 flex flex-col gap-8"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">Email</h3>
                <p className="text-sm text-muted">{email ?? "hello@tcreativestudio.com"}</p>
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
                        {s.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            </m.div>
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
