import type { Plan, User } from "@/lib/types";

export async function getAuthUser(): Promise<User | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;

  try {
    const { currentUser } = await import("@clerk/nextjs/server");
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? `${clerkUser.id}@flowtube.local`;
    const name =
      clerkUser.fullName ??
      clerkUser.firstName ??
      clerkUser.username ??
      email.split("@")[0] ??
      "Utilisateur";

    return {
      id: `clerk_${clerkUser.id}`,
      email,
      name,
      plan: (clerkUser.publicMetadata.plan as Plan | undefined) ?? "free",
      credits: Number(clerkUser.publicMetadata.credits ?? 80)
    };
  } catch {
    return null;
  }
}
