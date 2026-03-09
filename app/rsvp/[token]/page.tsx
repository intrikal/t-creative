import { notFound } from "next/navigation";
import { getEventByRsvpToken } from "@/app/rsvp/actions";
import { RsvpPage } from "./RsvpPage";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function RsvpTokenPage({ params }: Props) {
  const { token } = await params;
  const event = await getEventByRsvpToken(token);

  if (!event) notFound();

  return <RsvpPage event={event} token={token} />;
}
