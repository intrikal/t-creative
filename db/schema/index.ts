/**
 * db/schema/index.ts — Barrel export for all Drizzle ORM table definitions.
 *
 * ## Purpose
 * Provides a single import path for every table, enum, and Drizzle relation in
 * the database schema. Application code and Drizzle Kit both read from here.
 *
 * ## How Drizzle Kit uses this file
 * `drizzle.config.ts` points `schema` at this file. Drizzle Kit scans all
 * re-exported tables to detect schema changes and generate SQL migrations.
 * Adding a new table file requires a re-export here for migrations to pick it up.
 *
 * ## Import convention
 * Always import from `@/db/schema` (the barrel), never from individual files.
 * This keeps import paths stable if files are reorganised internally.
 *
 * @example
 *   import { profiles, bookings, bookingStatusEnum } from "@/db/schema";
 *
 * ## Schema modules
 * Modules are grouped logically below. Each group maps to one or more files
 * in db/schema/. Cross-file foreign keys are resolved by Drizzle's relations
 * system — see the `*Relations` exports in each module file.
 */

/* Enums */
export {
  userRoleEnum,
  bookingStatusEnum,
  paymentStatusEnum,
  paymentMethodEnum,
  serviceCategoryEnum,
  orderStatusEnum,
  inquiryStatusEnum,
  messageChannelEnum,
  mediaTypeEnum,
  formTypeEnum,
  invoiceStatusEnum,
  expenseCategoryEnum,
  giftCardStatusEnum,
  discountTypeEnum,
  waitlistStatusEnum,
  notificationTypeEnum,
  notificationStatusEnum,
  auditActionEnum,
  giftCardTxTypeEnum,
  subscriptionStatusEnum,
  membershipStatusEnum,
} from "./enums";

/* Users & RBAC */
export { clientSourceEnum, profiles, profilesRelations } from "./users";

/* Service catalog */
export {
  services,
  serviceAddOns,
  serviceBundles,
  clientForms,
  servicesRelations,
  serviceAddOnsRelations,
} from "./services";

/* Service categories (lookup table) */
export { serviceCategories } from "./service-categories";

/* Locations (multi-studio support) */
export { locations, locationsRelations } from "./locations";

/* Bookings & appointments */
export {
  bookings,
  bookingAddOns,
  bookingServices,
  bookingsRelations,
  bookingAddOnsRelations,
  bookingServicesRelations,
} from "./bookings";

/* Messaging */
export {
  threadTypeEnum,
  threadStatusEnum,
  threads,
  messages,
  quickReplies,
  threadParticipants,
  threadsRelations,
  messagesRelations,
  threadParticipantsRelations,
} from "./messages";

/* Payments (Square-synced) */
export { payments, paymentsRelations } from "./payments";

/* Reviews */
export { reviewStatusEnum, reviews, reviewsRelations } from "./reviews";

/* Products (marketplace catalog) */
export {
  productTypeEnum,
  pricingTypeEnum,
  productAvailabilityEnum,
  inventoryAdjustmentReasonEnum,
  products,
  productImages,
  inventoryAdjustments,
  productsRelations,
  productImagesRelations,
  inventoryAdjustmentsRelations,
} from "./products";

/* Orders (marketplace + custom commissions) */
export { orders, ordersRelations, type ShippingAddress } from "./orders";

/* Product inquiries (marketplace inquiry pipeline) */
export {
  productInquiryStatusEnum,
  productInquiries,
  productInquiriesRelations,
} from "./product-inquiries";

/* Inquiries (contact form) */
export { inquiries, inquiriesRelations } from "./inquiries";

/* Media & portfolio */
export { mediaItems, mediaItemsRelations } from "./media";

/* Training programs */
export {
  trainingFormatEnum,
  sessionStatusEnum,
  enrollmentStatusEnum,
  trainingPrograms,
  trainingSessions,
  trainingModules,
  trainingLessons,
  enrollments,
  sessionAttendance,
  certificates,
  lessonCompletions,
  trainingProgramsRelations,
  trainingSessionsRelations,
  trainingModulesRelations,
  trainingLessonsRelations,
  enrollmentsRelations,
  sessionAttendanceRelations,
  certificatesRelations,
  lessonCompletionsRelations,
} from "./training";

/* Events */
export {
  venueTypeEnum,
  eventTypeEnum,
  eventStatusEnum,
  eventVenues,
  events,
  eventStaff,
  eventGuests,
  eventVenuesRelations,
  eventsRelations,
  eventStaffRelations,
  eventGuestsRelations,
} from "./events";

/* Aftercare & policies */
export { policyTypeEnum, policies } from "./policies";

/* Legal documents (Privacy Policy & Terms of Service) */
export { legalDocumentTypeEnum, legalDocuments, type LegalSection } from "./legal-documents";

/* Settings */
export { settings } from "./settings";

/* Scheduling & availability */
export {
  timeOffTypeEnum,
  businessHours,
  timeOff,
  bookingRules,
  businessHoursRelations,
  timeOffRelations,
} from "./scheduling";

/* Wishlists (client saved products) */
export { wishlistItems, wishlistItemsRelations } from "./wishlists";

/* Assistants (staff profiles & shifts) */
export {
  shiftStatusEnum,
  assistantProfiles,
  shifts,
  assistantProfilesRelations,
  shiftsRelations,
} from "./assistants";

/* Loyalty points ledger */
export {
  loyaltyTxTypeEnum,
  loyaltyTransactions,
  loyaltyTransactionsRelations,
  type LoyaltyTxType,
} from "./loyalty";

/* Loyalty rewards catalog & redemptions */
export {
  loyaltyRewardCategoryEnum,
  loyaltyRedemptionStatusEnum,
  loyaltyRewards,
  loyaltyRedemptions,
  loyaltyRewardsRelations,
  loyaltyRedemptionsRelations,
} from "./loyalty-rewards";

/* Referrals */
export {
  referralStatusEnum,
  referralCodes,
  referrals,
  referralCodesRelations,
  referralsRelations,
} from "./referrals";

/* Client photos */
export { photoTypeEnum, clientPhotos, clientPhotosRelations } from "./client-photos";

/* Integrations (Square + Zoho sync) */
export {
  integrationProviderEnum,
  syncDirectionEnum,
  syncStatusEnum,
  syncLog,
  webhookEvents,
} from "./integrations";

/* Invoices */
export { invoices, invoicesRelations } from "./invoices";

/* Expenses */
export { expenses, expensesRelations } from "./expenses";

/* Gift Cards */
export { giftCards, giftCardsRelations } from "./gift-cards";

/* Promotions */
export { promotions, promotionsRelations } from "./promotions";

/* Supplies (service consumables) */
export { supplies } from "./supplies";

/* Form submissions (waiver/consent tracking) */
export { formSubmissions, formSubmissionsRelations } from "./form-submissions";

/* Waitlist */
export { waitlist, waitlistRelations } from "./waitlist";

/* Service records (post-appointment notes) */
export { serviceRecords, serviceRecordsRelations } from "./service-records";

/* Notifications */
export { notifications, notificationsRelations } from "./notifications";
export { pushSubscriptions, pushSubscriptionsRelations } from "./push-subscriptions";
export {
  notificationPreferences,
  notificationPreferencesRelations,
  notifChannelEnum,
  notifTypeEnum,
  NOTIF_CHANNELS,
  NOTIF_TYPES,
} from "./notification-preferences";
export type { NotifChannel, NotifType } from "./notification-preferences";

/* Instagram feed cache */
export { instagramPosts } from "./instagram";

/* Audit log */
export { auditLog } from "./audit-log";

/* Gift card transactions */
export { giftCardTransactions, giftCardTransactionsRelations } from "./gift-card-transactions";

/* Client preferences (beauty/service prefs) */
export { clientPreferences, clientPreferencesRelations } from "./client-preferences";

/* Client notes (communication history) */
export { clientNoteTypeEnum, clientNotes, clientNotesRelations } from "./client-notes";

/* Booking subscriptions (pre-paid session packages) */
export { bookingSubscriptions, bookingSubscriptionsRelations } from "./subscriptions";

/* Intake forms (per-service, versioned, booking-linked) */
export {
  intakeFieldTypeEnum,
  intakeFormDefinitions,
  intakeFormSubmissions,
  intakeFormDefinitionsRelations,
  intakeFormSubmissionsRelations,
  type IntakeFormField,
} from "./intake-forms";

/* Membership plans & subscriptions (Lash Club recurring memberships) */
export {
  membershipPlans,
  membershipSubscriptions,
  membershipPlansRelations,
  membershipSubscriptionsRelations,
} from "./memberships";

/* Email queue (rate-limit fallback for Resend sends) */
export { emailQueueStatusEnum, emailQueue, type EmailQueueMeta } from "./email-queue";

/* Email sequences (lifecycle drip campaigns) */
export {
  sequenceTriggerEnum,
  seqEnrollmentStatusEnum,
  emailSequences,
  emailSequenceSteps,
  emailSequenceEnrollments,
  emailSequencesRelations,
  emailSequenceStepsRelations,
  emailSequenceEnrollmentsRelations,
} from "./email-sequences";
