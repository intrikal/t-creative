/**
 * ContactPage — Client Component rendering the Contact page with form.
 *
 * Uses @tanstack/react-form for state and Zod for validation.
 */
"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { motion } from "framer-motion";
import { z } from "zod";
import { Footer } from "@/components/landing/Footer";
import { socials } from "@/lib/socials";

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

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

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

      // TODO: Send to API endpoint / Supabase
      setSubmitted(true);
    },
  });

  return (
    <>
      <main id="main-content" className="pt-16">
        {/* Hero */}
        <section className="py-24 md:py-32 px-6">
          <div className="mx-auto max-w-5xl text-center">
            <motion.span
              className="text-xs tracking-widest uppercase text-muted mb-6 block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Contact
            </motion.span>
            <motion.h1
              className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Let&apos;s create something beautiful.
            </motion.h1>
            <motion.p
              className="text-base md:text-lg text-muted max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Whether you&apos;re booking an appointment, requesting a consultation, or just have a
              question — I&apos;d love to hear from you.
            </motion.p>
          </div>
        </section>

        {/* Form + Info */}
        <section className="pb-32 px-6">
          <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-5 gap-12 md:gap-16">
            {/* Form */}
            <motion.div
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
            </motion.div>

            {/* Info sidebar */}
            <motion.div
              className="md:col-span-2 flex flex-col gap-8"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">Email</h3>
                <p className="text-sm text-muted">hello@tcreativestudio.com</p>
              </div>

              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">Location</h3>
                <p className="text-sm text-muted">San Jose, California</p>
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
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
