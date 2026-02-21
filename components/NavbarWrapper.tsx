/**
 * NavbarWrapper — Server component that fetches auth state for the Navbar.
 *
 * Calls getCurrentUser() on the server and passes the result as props
 * to the client-side Navbar component.
 */
import { getCurrentUser } from "@/lib/auth";
import { Navbar } from "./Navbar";

export async function NavbarWrapper() {
  const user = await getCurrentUser();

  return (
    <Navbar
      user={
        user
          ? {
              name: user.profile?.firstName || user.email,
              avatarUrl: user.profile?.avatarUrl ?? undefined,
            }
          : null
      }
    />
  );
}
