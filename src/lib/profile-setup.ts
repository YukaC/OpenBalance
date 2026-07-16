import type { UserProfile } from "./types";

/** Seed / claimed profiles skip onboarding; empty name also counts as incomplete. */
export function needsProfileSetup(profile: UserProfile): boolean {
  if (!profile.name.trim()) return true;
  return profile.isSetupComplete !== true;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
