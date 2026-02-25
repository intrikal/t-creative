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

/* Bookings & appointments */
export { bookings, bookingAddOns, bookingsRelations, bookingAddOnsRelations } from "./bookings";

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
  products,
  productImages,
  productsRelations,
  productImagesRelations,
} from "./products";

/* Orders (marketplace + custom commissions) */
export { orders, ordersRelations } from "./orders";

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
  eventTypeEnum,
  eventStatusEnum,
  events,
  eventGuests,
  eventsRelations,
  eventGuestsRelations,
} from "./events";

/* Aftercare & policies */
export { policyTypeEnum, policies } from "./policies";

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
