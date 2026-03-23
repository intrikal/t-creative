import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEventByRsvpToken } from "@/app/rsvp/actions";
import { RsvpPage } from "./RsvpPage";

export const metadata: Metadata = {
  title: "RSVP",
  description: "Respond to your event invitation.",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function RsvpTokenPage({ params }: Props) {
  const { token } = await params;
  const event = await getEventByRsvpToken(token);

  if (!event) notFound();

  return <RsvpPage event={event} token={token} />;
}
