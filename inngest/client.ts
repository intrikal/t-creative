/**
 * inngest/client.ts — Shared Inngest client instance.
 *
 * All Inngest functions import this client so there's a single event bus.
 * The ID must match the Inngest dashboard project and the serve() handler.
 */
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "t-creative" });
