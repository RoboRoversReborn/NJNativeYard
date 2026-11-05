"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { AppUser as User } from "@/lib/firebase/auth-user";

export type PersonalHeaderNavProps = {
  user: User;
  active: "home" | "yard" | null;
  onHome: () => void;
  onYard: () => void;
  onSettings: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function identity(user: User) {
  const metadata = user.user_metadata ?? {};
  const name = text(metadata.full_name) || text(metadata.name) || text(metadata.given_name) || text(user.email?.split("@")[0]) || "Welcome";
  let avatar = "";
  for (const candidate of [metadata.avatar_url, metadata.picture]) {
    try {
      const url = new URL(text(candidate));
      if (url.protocol === "https:" && !url.username && !url.password) {
        avatar = url.href;
        break;
      }
    } catch { /* Missing or invalid profile photo uses initials. */ }
  }
  const parts = name.split(/\s+/);
  return { name, firstName: parts[0], initials: (parts[0][0] + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase(), avatar };
}

export function PersonalHeaderNav(props: PersonalHeaderNavProps) {
  const profile = identity(props.user);
  return <ProfileNavigation key={`${props.user.id}:${profile.name}:${profile.avatar}`} {...props} profile={profile} />;
}

function ProfileNavigation({ active, onHome, onYard, onSettings, onSignOut, signingOut, profile }: PersonalHeaderNavProps & { profile: ReturnType<typeof identity> }) {
  const [open, setOpen] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (event.target instanceof window.Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("click", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("click", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [open]);

  function focusItem(index: number) {
    const enabled = items.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled));
    enabled[(index + enabled.length) % enabled.length]?.focus();
  }

  function openAt(index: number) {
    setOpen(true);
    if (window.requestAnimationFrame) window.requestAnimationFrame(() => focusItem(index));
    else window.setTimeout(() => focusItem(index), 0);
  }

  function menuKey(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = items.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled));
    const current = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      opener.current?.focus();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      focusItem(event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : current + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Tab") {
      // Restore the trigger as the tab origin and let the browser move normally.
      opener.current?.focus();
      setOpen(false);
    }
  }

  return <div className="ny-personal-header" ref={root}>
    <nav aria-label="Primary navigation" className="ny-personal-primary">
      <button type="button" aria-current={active === "home" ? "page" : undefined} onClick={() => { setOpen(false); onHome(); }}>Home</button>
      <button type="button" aria-current={active === "yard" ? "page" : undefined} onClick={() => { setOpen(false); onYard(); }}>My yard</button>
    </nav>
    <div className="ny-personal-profile">
      <span className="ny-personal-greeting">Hi {profile.firstName}</span>
      <button ref={opener} type="button" className="ny-personal-avatar" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => { if (open) setOpen(false); else openAt(0); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openAt(event.key === "ArrowDown" ? 0 : signingOut ? 0 : 1); }
        if (event.key === "Escape") setOpen(false);
      }}>
        {/* Provider avatar hosts vary; use a direct image with no referrer and an error fallback. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {profile.avatar && !failedPhoto ? <img src={profile.avatar} alt="" referrerPolicy="no-referrer" onError={() => setFailedPhoto(true)} /> : <span aria-hidden="true">{profile.initials}</span>}
      </button>
      {open && <div className="ny-personal-menu" role="menu" aria-label="Profile" id={menuId} onKeyDown={menuKey}>
        <p className="ny-personal-menu-name">{profile.name}</p>
        <button ref={(node) => { items.current[0] = node; }} role="menuitem" tabIndex={-1} type="button" onClick={() => { setOpen(false); onSettings(); }}>Settings</button>
        <button ref={(node) => { items.current[1] = node; }} role="menuitem" tabIndex={-1} type="button" disabled={signingOut} onClick={() => { setOpen(false); onSignOut(); }}>{signingOut ? "Signing out…" : "Sign out"}</button>
      </div>}
    </div>
  </div>;
}
