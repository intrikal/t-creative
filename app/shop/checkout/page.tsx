import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { CheckoutPage } from "./CheckoutPage";

export const metadata: Metadata = {
  title: "Checkout — T Creative Studio",
};

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <CheckoutPage user={user ? { id: user.id, email: user.email ?? "" } : null} />;
}
