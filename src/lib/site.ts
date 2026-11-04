import "server-only";
import { getMembership } from "@/lib/membership";

/** The contact address, only for accounts on a batch list. Any Google account can sign in, so a session isn't enough. */
export async function getContactEmailForMember(): Promise<string | null> {
  const email = process.env.CONTACT_EMAIL?.trim();
  if (!email) return null;
  return (await getMembership()) ? email : null;
}
