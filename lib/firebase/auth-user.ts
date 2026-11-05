import type { User as FirebaseUser } from "firebase/auth";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type AppUser = {
  id: string;
  aud: string;
  role?: string;
  email?: string;
  phone?: string;
  created_at: string;
  confirmed_at?: string;
  last_sign_in_at?: string;
  app_metadata: {
    provider?: string;
    providers?: string[];
    nativeyard_qa?: boolean;
    [key: string]: unknown;
  };
  user_metadata: {
    full_name?: string | null;
    name?: string | null;
    given_name?: string | null;
    avatar_url?: string | null;
    picture?: string | null;
    [key: string]: unknown;
  };
  identities?: unknown[];
  updated_at?: string;
  is_anonymous?: boolean;
};

export function mapFirebaseUser(user: FirebaseUser | null): AppUser | null {
  if (!user) return null;
  const name = user.displayName || "";
  const firstName = name.split(/\s+/)[0] || "";
  const provider = user.providerData[0]?.providerId || "google.com";
  return {
    id: user.uid,
    aud: "authenticated",
    role: "authenticated",
    email: user.email || undefined,
    phone: user.phoneNumber || undefined,
    created_at: user.metadata.creationTime || new Date().toISOString(),
    last_sign_in_at: user.metadata.lastSignInTime || undefined,
    user_metadata: {
      full_name: name,
      name,
      given_name: firstName,
      avatar_url: user.photoURL,
      picture: user.photoURL,
    },
    app_metadata: {
      provider,
      providers: [provider],
    },
    is_anonymous: user.isAnonymous,
  };
}

export function mapSupabaseUser(user: SupabaseUser | null): AppUser | null {
  if (!user) return null;
  return {
    ...user,
    user_metadata: (user.user_metadata || {}) as Record<string, unknown>,
    app_metadata: (user.app_metadata || {}) as Record<string, unknown>,
  };
}
