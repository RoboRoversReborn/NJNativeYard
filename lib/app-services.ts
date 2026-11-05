import * as account from "./account/repository";
import * as drafts from "./account/draft";
import {
  isFirebaseConfigured,
  getFirebaseAuth,
} from "./firebase/client";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
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
      return onAuthStateChanged(auth, (fbUser) => {
        callback(mapFirebaseUser(fbUser));
      });
    },
    async signIn() {
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error("Firebase Authentication is not configured.");
      }
      const provider = new GoogleAuthProvider();
      // Enforce select_account prompt so users can easily pick accounts
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
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
