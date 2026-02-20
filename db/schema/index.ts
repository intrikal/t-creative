/**
 * schema — Barrel export for all Drizzle ORM table definitions.
 *
 * Import from `@/db/schema` to access any table, enum, or relation.
 * Drizzle Kit reads this file (via drizzle.config.ts) to generate
 * SQL migrations.
 *
 * @example
 *   import { profiles, bookings, bookingStatusEnum } from "@/db/schema";
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
} from "./enums";

/* Users & RBAC */
export { clientSourceEnum, profiles, profilesRelations } from "./users";

/* Service catalog */
export { services, serviceAddOns, servicesRelations, serviceAddOnsRelations } from "./services";

/* Bookings & appointments */
export { bookings, bookingAddOns, bookingsRelations, bookingAddOnsRelations } from "./bookings";

/* Messaging */
export {
  threadTypeEnum,
  threadStatusEnum,
  threads,
  messages,
  quickReplies,
  threadsRelations,
  messagesRelations,
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
  trainingProgramsRelations,
  trainingSessionsRelations,
  trainingModulesRelations,
  trainingLessonsRelations,
  enrollmentsRelations,
  sessionAttendanceRelations,
  certificatesRelations,
} from "./training";

/* Events */
export { eventTypeEnum, eventStatusEnum, events, eventsRelations } from "./events";

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

/* Integrations (Square + Zoho sync) */
export {
  integrationProviderEnum,
  syncDirectionEnum,
  syncStatusEnum,
  syncLog,
  webhookEvents,
} from "./integrations";
