"use client";
import { useState } from "react";
export function QaSignIn({
  busy = false,
  onSignedIn = () =>
    window.location.assign(new URL("/?view=home", window.location.origin).href),
}: {
  busy?: boolean;
  onSignedIn?: () => void;
}) {
  const [pending, setPending] = useState<"A" | "B" | null>(null),
    [error, setError] = useState("");
  async function signIn(account: "A" | "B") {
    if (busy || pending) return;
    setPending(account);
    setError("");
    try {
      const response = await fetch("/api/qa-login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true)
        throw new Error(
          "Local QA sign-in could not be completed. Check the local account setup and try again.",
        );
      onSignedIn();
    } catch {
      setError(
        "Local QA sign-in could not be completed. Check the local account setup and try again.",
      );
      setPending(null);
    }
  }
  return (
    <section className="local-qa-sign-in">
      <h3>Local QA only</h3>
      <p className="micro">
        Dedicated persistent test accounts. These accounts were seeded for local
        testing; this does not verify an email address.
      </p>
      <div className="actions">
        {(["A", "B"] as const).map((account) => (
          <button
            className="secondary"
            key={account}
            disabled={busy || !!pending}
            onClick={() => void signIn(account)}
          >
            {pending === account ? "Signing in…" : `Use QA account ${account}`}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
