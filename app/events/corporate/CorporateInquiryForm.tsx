/**
 * CorporateInquiryForm — Client Component for /events/corporate.
 *
 * Uses @tanstack/react-form + Zod for validation and react-day-picker
 * (via the Calendar UI component) for date selection.
 */
"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { useForm } from "@tanstack/react-form";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { CalendarIcon } from "lucide-react";
import { z } from "zod";
import { Footer } from "@/components/landing/Footer";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { corporateInquirySchema, submitCorporateInquiry } from "./actions";

type FormData = Omit<z.infer<typeof corporateInquirySchema>, "turnstileToken">;

const inputClasses =
  "w-full px-4 py-3 bg-surface text-foreground text-sm border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors";
const errorInputClasses =
  "w-full px-4 py-3 bg-surface text-foreground text-sm border border-error/40 outline-none focus-visible:ring-2 focus-visible:ring-error/50 transition-colors";
const labelClasses = "text-xs tracking-wide uppercase text-muted mb-2 block";
const errorClasses = "text-xs text-error mt-1.5";

const eventTypes = [
  { value: "team_bonding", label: "Team Bonding" },
  { value: "offsite", label: "Offsite / Retreat" },
  { value: "celebration", label: "Celebration / Milestone" },
  { value: "other", label: "Other" },
];

const serviceOptions = [
  { value: "lash", label: "Lash Extensions" },
  { value: "jewelry", label: "Permanent Jewelry" },
  { value: "both", label: "Both" },
];

export function CorporateInquiryForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const form = useForm({
    defaultValues: {
      contactName: "",
      email: "",
      phone: "",
      companyName: "",
      headcount: 1,
      preferredDate: "",
      services: "",
      eventType: "",
      details: "",
    } as FormData,
    onSubmit: async ({ value }) => {
      setServerError("");
      const result = await submitCorporateInquiry({ ...value, turnstileToken });
      if (result.success) {
        setSubmitted(true);
      } else {
        setServerError(result.error);
      }
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
              Corporate Events
            </motion.span>
            <motion.h1
              className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Bring the studio to your team.
            </motion.h1>
            <motion.p
              className="text-base md:text-lg text-muted max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Permanent jewelry and lash services for team bonding events, offsites, and company
              celebrations. We come to you.
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
                  <p className="text-lg text-foreground mb-2">Inquiry received.</p>
                  <p className="text-sm text-muted">
                    We&apos;ll review your request and get back to you within 24–48 hours.
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
                    {/* Contact Name */}
                    <form.Field
                      name="contactName"
                      validators={{
                        onBlur: ({ value }) => {
                          const r = corporateInquirySchema.shape.contactName.safeParse(value);
                          return r.success ? undefined : r.error.issues[0].message;
                        },
                      }}
                    >
                      {(field) => (
                        <div>
                          <label htmlFor={field.name} className={labelClasses}>
                            Contact Name *
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

                    {/* Company Name */}
                    <form.Field
                      name="companyName"
                      validators={{
                        onBlur: ({ value }) => {
                          const r = corporateInquirySchema.shape.companyName.safeParse(value);
                          return r.success ? undefined : r.error.issues[0].message;
                        },
                      }}
                    >
                      {(field) => (
                        <div>
                          <label htmlFor={field.name} className={labelClasses}>
                            Company *
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
                            placeholder="Your company"
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Email */}
                    <form.Field
                      name="email"
                      validators={{
                        onBlur: ({ value }) => {
                          const r = corporateInquirySchema.shape.email.safeParse(value);
                          return r.success ? undefined : r.error.issues[0].message;
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
                            placeholder="you@company.com"
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

                    {/* Phone */}
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
                            placeholder="(555) 000-0000"
                          />
                        </div>
                      )}
                    </form.Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Event Type */}
                    <form.Field
                      name="eventType"
                      validators={{
                        onBlur: ({ value }) => {
                          const r = corporateInquirySchema.shape.eventType.safeParse(value);
                          return r.success ? undefined : r.error.issues[0].message;
                        },
                      }}
                    >
                      {(field) => (
                        <div>
                          <label htmlFor={field.name} className={labelClasses}>
                            Event Type *
                          </label>
                          <select
                            id={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className={cn(
                              field.state.meta.errors.length > 0 ? errorInputClasses : inputClasses,
                              "appearance-none",
                            )}
                            aria-invalid={field.state.meta.errors.length > 0 || undefined}
                            aria-describedby={
                              field.state.meta.errors.length > 0 ? `${field.name}-error` : undefined
                            }
                          >
                            <option value="" disabled>
                              Select event type
                            </option>
                            {eventTypes.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
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

                    {/* Headcount */}
                    <form.Field
                      name="headcount"
                      validators={{
                        onBlur: ({ value }) => {
                          const r = corporateInquirySchema.shape.headcount.safeParse(value);
                          return r.success ? undefined : r.error.issues[0].message;
                        },
                      }}
                    >
                      {(field) => (
                        <div>
                          <label htmlFor={field.name} className={labelClasses}>
                            Estimated Headcount *
                          </label>
                          <input
                            id={field.name}
                            type="number"
                            min={1}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(Number(e.target.value))}
                            className={
                              field.state.meta.errors.length > 0 ? errorInputClasses : inputClasses
                            }
                            placeholder="e.g. 20"
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

                  {/* Services */}
                  <form.Field
                    name="services"
                    validators={{
                      onBlur: ({ value }) => {
                        const r = corporateInquirySchema.shape.services.safeParse(value);
                        return r.success ? undefined : r.error.issues[0].message;
                      },
                    }}
                  >
                    {(field) => (
                      <div>
                        <span className={labelClasses}>Services Interested In *</span>
                        <div
                          className="flex flex-col sm:flex-row gap-3"
                          role="group"
                          aria-label="Services"
                        >
                          {serviceOptions.map((opt) => (
                            <label
                              key={opt.value}
                              className="flex items-center gap-2.5 cursor-pointer"
                            >
                              <input
                                type="radio"
                                name={field.name}
                                value={opt.value}
                                checked={field.state.value === opt.value}
                                onChange={() => field.handleChange(opt.value)}
                                onBlur={field.handleBlur}
                                className="accent-foreground"
                              />
                              <span className="text-sm text-foreground">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                        {field.state.meta.errors.length > 0 && (
                          <p className={errorClasses} role="alert">
                            {field.state.meta.errors[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>

                  {/* Preferred Date */}
                  <form.Field name="preferredDate">
                    {(field) => (
                      <div>
                        <label className={labelClasses}>Preferred Date</label>
                        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                inputClasses,
                                "flex items-center justify-between text-left",
                                !field.state.value && "text-muted",
                              )}
                            >
                              <span>
                                {selectedDate
                                  ? format(selectedDate, "PPP")
                                  : "Pick a date (optional)"}
                              </span>
                              <CalendarIcon size={14} className="shrink-0 opacity-50" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => {
                                setSelectedDate(date);
                                field.handleChange(date ? format(date, "yyyy-MM-dd") : "");
                                setCalendarOpen(false);
                              }}
                              disabled={{ before: new Date() }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </form.Field>

                  {/* Additional Details */}
                  <form.Field name="details">
                    {(field) => (
                      <div>
                        <label htmlFor={field.name} className={labelClasses}>
                          Additional Details
                        </label>
                        <textarea
                          id={field.name}
                          rows={4}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          className={`${inputClasses} resize-none`}
                          placeholder="Share any additional context — venue, timeline, budget, special requests..."
                        />
                      </div>
                    )}
                  </form.Field>

                  <Turnstile
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                    onSuccess={setTurnstileToken}
                    onExpire={() => setTurnstileToken("")}
                    options={{ theme: "light" }}
                  />

                  {serverError && (
                    <p className={errorClasses} role="alert">
                      {serverError}
                    </p>
                  )}

                  <form.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                      <button
                        type="submit"
                        disabled={isSubmitting || !turnstileToken}
                        className="self-start px-8 py-3.5 text-xs tracking-wide uppercase bg-foreground text-background hover:bg-muted transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? "Sending..." : "Submit Inquiry"}
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
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">
                  What We Offer
                </h3>
                <p className="text-sm text-muted">
                  On-site permanent jewelry and lash extension pop-ups — we bring everything to your
                  space.
                </p>
              </div>

              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">
                  Great For
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {[
                    "Team bonding days",
                    "Company offsites",
                    "Holiday celebrations",
                    "Employee appreciation events",
                    "Milestone milestones",
                  ].map((item) => (
                    <li key={item} className="text-sm text-muted">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">
                  Min. Group Size
                </h3>
                <p className="text-sm text-muted">10 guests</p>
              </div>

              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">
                  Response Time
                </h3>
                <p className="text-sm text-muted">Typically within 24–48 hours</p>
              </div>

              <div>
                <h3 className="text-xs tracking-widest uppercase text-foreground mb-3">Email</h3>
                <p className="text-sm text-muted">hello@tcreativestudio.com</p>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
