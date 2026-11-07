import * as account from "./account/repository";
import * as drafts from "./account/draft";
import {
  isFirebaseConfigured,
  getFirebaseAuth,
} from "./firebase/client";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import { mapFirebaseUser, type AppUser } from "./firebase/auth-user";

export type User = AppUser;

export const appServices = {
  account,
  drafts,
  auth: {
    async currentUser(): Promise<AppUser | null> {
      if (!isFirebaseConfigured()) return null;
      const auth = getFirebaseAuth();
      if (!auth) return null;
      return mapFirebaseUser(auth.currentUser);
    },
    subscribe(callback: (user: AppUser | null) => void) {
      if (!isFirebaseConfigured()) {
        callback(null);
        return () => {};
      }
      const auth = getFirebaseAuth();
      if (!auth) {
        callback(null);
        return () => {};
      }

      // Check redirect result on load to catch returning users from signInWithRedirect
      if (typeof window !== "undefined") {
        getRedirectResult(auth)
          .then((result) => {
            if (result?.user) {
              callback(mapFirebaseUser(result.user));
            }
          })
          .catch((err) => {
            // Ignore no-redirect errors
            if (err?.code !== "auth/null-user") {
              console.warn("Firebase redirect auth result:", err);
            }
          });
      }

      return onAuthStateChanged(auth, (fbUser) => {
        callback(mapFirebaseUser(fbUser));
      });
    },
    async signIn() {
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error("Firebase Authentication is not configured.");
      }

      // Ensure persistence is set reliably
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        try {
          await setPersistence(auth, browserSessionPersistence);
        } catch {
          /* Fallback to in-memory if browser storage is restricted */
        }
      }

      const provider = new GoogleAuthProvider();
      // Enforce select_account prompt so users can pick or switch accounts
      provider.setCustomParameters({ prompt: "select_account" });

      const isMobile =
        typeof window !== "undefined" &&
        (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
          window.innerWidth < 768);

      // On mobile devices, browsers (Safari iOS, Chrome Android, in-app webviews)
      // aggressively block popups. Use redirect directly for a smooth, native experience.
      if (isMobile) {
        await signInWithRedirect(auth, provider);
        return;
      }

      // On desktop, try popup first for an instant modal flow
      try {
        await signInWithPopup(auth, provider);
      } catch (err: any) {
        // If popup was blocked or interrupted, seamlessly fall back to redirect
        if (
          err?.code === "auth/popup-blocked" ||
          err?.code === "auth/cancelled-popup-request" ||
          err?.code === "auth/internal-error"
        ) {
          console.warn("Google popup blocked/failed, falling back to redirect:", err?.code);
          await signInWithRedirect(auth, provider);
          return;
        }

        // If user explicitly closed the popup window, do not throw an error
        if (err?.code === "auth/popup-closed-by-user") {
          return;
        }

        throw err;
      }
    },
    async sendEmailCode(email: string) {
      email = email.trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address.");
      }
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Email sign-in is not configured.");
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/?view=home`,
        handleCodeInApp: true,
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("nativeyard_email_for_signin", email);
      }
    },
    async verifyEmailCode(email: string, code?: string) {
      email = email.trim().toLowerCase();
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Email sign-in is not configured.");
      if (typeof window !== "undefined" && isSignInWithEmailLink(auth, window.location.href)) {
        await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem("nativeyard_email_for_signin");
      }
    },
    async signOut() {
      const auth = getFirebaseAuth();
      if (auth) {
        await firebaseSignOut(auth);
      }
      try {
        window.localStorage.setItem("nativeyard-signed-out", String(Date.now()));
      } catch {
        /* Local storage cleanup */
      }
      return { remoteRevoked: true, reloadRequired: true as const };
    },
  },
};

type ProductionAuth = typeof appServices.auth;
export type AppServices = Omit<typeof appServices, "auth"> & {
  auth: Omit<ProductionAuth, "sendEmailCode" | "verifyEmailCode" | "signOut"> & {
    signOut: () => Promise<void | {
      remoteRevoked: boolean;
      reloadRequired: true;
    }>;
  } & Partial<Pick<ProductionAuth, "sendEmailCode" | "verifyEmailCode">>;
};
