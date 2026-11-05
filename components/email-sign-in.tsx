"use client";
import { useEffect, useId, useState } from "react";

export type EmailSignInProps = {
  onSendEmailCode: (email: string) => Promise<void>;
  onVerifyEmailCode: (email: string, token: string) => Promise<void>;
  busy?: boolean;
};

export function EmailSignIn({
  onSendEmailCode,
  onVerifyEmailCode,
  busy = false,
}: EmailSignInProps) {
  const [email, setEmail] = useState("");
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [lastSent, setLastSent] = useState({ email: "", until: 0 });
  const [now, setNow] = useState(() => Date.now());
  const errorId = useId();
  const normalized = email.trim().toLowerCase();
  const seconds =
    normalized === lastSent.email
      ? Math.max(0, Math.ceil((lastSent.until - now) / 1000))
      : 0;
  const locked = busy || pending || accepted;
  useEffect(() => {
    if (lastSent.until <= Date.now()) return;
    const timer = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= lastSent.until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastSent]);
  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    if (locked || seconds > 0) return;
    setError("");
    setMessage("");
    if (
      normalized.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    try {
      await onSendEmailCode(normalized);
      setRequestedEmail(normalized);
      setCode("");
      const sentAt = Date.now();
      setNow(sentAt);
      setLastSent({ email: normalized, until: sentAt + 60000 });
      setMessage(
        "Check your inbox for a sign-in code. You are not signed in until your code is verified.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "A sign-in code could not be requested. Try again later.",
      );
    } finally {
      setPending(false);
    }
  }
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (locked || !requestedEmail) return;
    setError("");
    setMessage("");
    const token = code.trim();
    if (!/^\d{6,10}$/.test(token)) {
      setError("Enter the 6–10 digit code from your email.");
      return;
    }
    setPending(true);
    try {
      await onVerifyEmailCode(requestedEmail, token);
      setAccepted(true);
      setCode("");
      setMessage("Code accepted. Finishing sign-in…");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "That code could not be verified. Request a new code and try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="email-sign-in">
      <h3>Continue with email</h3>
      <p className="micro">
        We’ll email a one-time code. Verify it to sign in or create your
        profile. No password needed.
      </p>
      {!requestedEmail ? (
        <form onSubmit={send} noValidate>
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              disabled={locked}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
            />
          </label>
          <button className="primary" disabled={locked || seconds > 0}>
            {pending ? "Requesting code…" : "Send sign-in code"}
          </button>
          {seconds > 0 && (
            <p className="micro">
              You can request another code in {seconds} seconds.
            </p>
          )}
        </form>
      ) : (
        <form onSubmit={verify} noValidate>
          <p>
            Code requested for <strong>{requestedEmail}</strong>.
          </p>
          <label>
            Sign-in code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              value={code}
              disabled={locked}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              onChange={(e) => {
                setCode(e.target.value.replace(/\s/g, ""));
                setError("");
              }}
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={locked}>
              {pending ? "Verifying…" : "Verify code"}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={locked}
              onClick={() => {
                setRequestedEmail(null);
                setCode("");
                setError("");
                setMessage("");
              }}
            >
              Change email
            </button>
            <button
              className="text-button"
              type="button"
              disabled={locked || seconds > 0}
              onClick={() => void send()}
            >
              Send a new code
            </button>
          </div>
          {seconds > 0 && (
            <p className="micro">
              You can request another code in {seconds} seconds.
            </p>
          )}
        </form>
      )}
      {error && (
        <p role="alert" id={errorId}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
