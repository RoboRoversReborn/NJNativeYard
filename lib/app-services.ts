import { authCookieNames, boundedLogout } from "./account/logout";
import { createClient } from "./account/client";
import * as account from "./account/repository";
import * as drafts from "./account/draft";
import type { User } from "@supabase/supabase-js";
export const appServices = {
  account,
  drafts,
  auth: {
    async currentUser() {
      const client = createClient();
      if (!client) return null;
      const { data, error } = await client.auth.getUser();
      if (error?.name === "AuthSessionMissingError") return null;
      if (error) throw new Error("Account session could not be verified.");
      return data.user;
    },
    subscribe(callback: (user: User | null) => void) {
      const sub = createClient()?.auth.onAuthStateChange((_event, session) =>
        callback(session?.user || null),
      );
      const localLogout = (event: StorageEvent) => {
        if (event.key === "nativeyard-signed-out") {
          callback(null);
          void createClient()?.auth.stopAutoRefresh();
          window.location.replace("/?view=welcome&logout=local");
        }
      };
      window.addEventListener("storage", localLogout);
      return () => {
        sub?.data.subscription.unsubscribe();
        window.removeEventListener("storage", localLogout);
      };
    },
    async signIn() {
      const client = createClient();
      if (!client) throw new Error("Google sign-in is not configured.");
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
    },
    async sendEmailCode(email: string) {
      const client = createClient();
      if (!client) throw new Error("Email sign-in is not configured.");
      email = email.trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error("Enter a valid email address.");
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });
      if (error) throw emailAuthError(error, "send");
    },
    async verifyEmailCode(email: string, token: string) {
      const client = createClient();
      if (!client) throw new Error("Email sign-in is not configured.");
      email = email.trim().toLowerCase();
      token = token.trim();
      if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !/^\d{6,10}$/.test(token)
      )
        throw new Error(
          "Enter your email address and the code from your email.",
        );
      const { data, error } = await client.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) throw emailAuthError(error, "verify");
      if (!data.user || !data.session || data.session.user.id !== data.user.id)
        throw new Error(
          "Email verification did not create a session. Request a new code and try again.",
        );
    },
    async signOut() {
      const client = createClient();
      if (!client) return;
      void client.auth.stopAutoRefresh();
      return boundedLogout(
        async (signal) => {
          const response = await fetch("/api/sign-out", {
            method: "POST",
            credentials: "same-origin",
            signal,
          });
          if (!response.ok) throw new Error("Sign-out request failed");
          return await response.json();
        },
        () => {
          for (const name of authCookieNames(
            document.cookie,
            process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          ))
            document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
          try {
            window.localStorage.setItem(
              "nativeyard-signed-out",
              String(Date.now()),
            );
          } catch {
            /* Cookie removal and reload do not require localStorage. */
          }
        },
      );
    },
  },
};
function emailAuthError(
  error: { code?: string; status?: number },
  phase: "send" | "verify",
) {
  if (
    error.status === 429 ||
    ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
      error.code || "",
    )
  )
    return new Error("Too many attempts. Wait a little before trying again.");
  if (
    phase === "verify" &&
    [
      "otp_expired",
      "otp_disabled",
      "invalid_credentials",
      "validation_failed",
    ].includes(error.code || "")
  )
    return new Error(
      "That code is invalid or expired. Request a new code and try again.",
    );
  return new Error(
    phase === "send"
      ? "A sign-in code could not be requested. Try again later or keep exploring without an account."
      : "That code could not be verified. Request a new code and try again.",
  );
}
type ProductionAuth = typeof appServices.auth;
export type AppServices = Omit<typeof appServices, "auth"> & {
  auth: Omit<
    ProductionAuth,
    "sendEmailCode" | "verifyEmailCode" | "signOut"
  > & {
    signOut: () => Promise<void | {
      remoteRevoked: boolean;
      reloadRequired: true;
    }>;
  } & Partial<Pick<ProductionAuth, "sendEmailCode" | "verifyEmailCode">>;
};
