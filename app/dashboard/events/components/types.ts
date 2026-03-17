/**
 * @file types.ts
 * @description Shared form-state types for the events dashboard.
 */

import type { EventType, EventStatus, VenueType } from "../actions";

export type EventForm = {
  title: string;
  type: EventType;
  status: EventStatus;
  date: string;
  time: string;
  endTime: string;
  venueId: string; // "" = custom/no venue, otherwise string of numeric id
  location: string; // used when venueId = ""
  capacity: string;
  revenue: string;
  deposit: string;
  travelFee: string;
  notes: string;
  equipmentNotes: string;
  /** Corporate billing — visible when type is "corporate" or isCorporate is checked. */
  isCorporate: boolean;
  companyName: string;
  billingEmail: string;
  poNumber: string;
};

export type VenueForm = {
  name: string;
  venueType: VenueType;
  address: string;
  parkingInfo: string;
  setupNotes: string;
  travelFee: string;
};
