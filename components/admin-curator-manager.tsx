"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Crown,
  UserCog,
  RefreshCw,
} from "lucide-react";
import type { AppUser } from "@/lib/firebase/auth-user";
import {
  CuratorRecord,
  getCuratorList,
  setCuratorRole,
  removeCurator,
  isAdmin,
} from "@/lib/curated-plants-service";

interface AdminCuratorManagerProps {
  user: AppUser;
  isOpen: boolean;
  onClose: () => void;
}

export function AdminCuratorManager({
  user,
  isOpen,
  onClose,
}: AdminCuratorManagerProps) {
  const [curators, setCurators] = useState<CuratorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New curator form state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "curator">("admin");
  const [submitting, setSubmitting] = useState(false);

  // Row update action state
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const isUserAdmin = isAdmin(user);

  useEffect(() => {
    if (isOpen) {
      loadCurators();
    }
  }, [isOpen]);

  async function loadCurators() {
    setLoading(true);
    setError("");
    try {
      const list = await getCuratorList();
      setCurators(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load curators list.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGrantAccess(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await setCuratorRole(email, newRole, user, newName.trim());
      setSuccess(`Granted ${newRole === "admin" ? "Administrator" : "Curator"} access to ${email}.`);
      setNewEmail("");
      setNewName("");
      await loadCurators();
    } catch (err: any) {
      setError(err?.message || "Could not assign role. Ensure you have administrator rights.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(email: string, targetRole: "admin" | "curator", currentName?: string) {
    setBusyEmail(email);
    setError("");
    setSuccess("");
    try {
      await setCuratorRole(email, targetRole, user, currentName);
      setSuccess(`Updated role for ${email} to ${targetRole === "admin" ? "Administrator" : "Curator"}.`);
      await loadCurators();
    } catch (err: any) {
      setError(err?.message || "Failed to update role.");
    } finally {
      setBusyEmail(null);
    }
  }

  async function handleRemove(email: string) {
    const isOwner = email.toLowerCase() === "niravgadhia@gmail.com";
    if (isOwner) {
      setError("Primary owner cannot be removed.");
      return;
    }

    if (!confirm(`Revoke all catalog and admin access for ${email}?`)) {
      return;
    }

    setBusyEmail(email);
    setError("");
    setSuccess("");
    try {
      await removeCurator(email, user);
      setSuccess(`Revoked access for ${email}.`);
      await loadCurators();
    } catch (err: any) {
      setError(err?.message || "Failed to remove user.");
    } finally {
      setBusyEmail(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="curator-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-manager-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="curator-modal-card admin-manager-modal">
        {/* Header */}
        <div className="curator-modal-header">
          <div className="curator-header-title">
            <span className="curator-badge-pill">
              <ShieldCheck size={14} /> Team & Permissions
            </span>
            <h2 id="admin-manager-title">Admin & Curator Management</h2>
            <p className="curator-header-sub">
              Grant trusted contributors access to curate flora records, upload field photos, or manage administrator privileges.
            </p>
          </div>
          <button
            type="button"
            className="curator-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="curator-alert error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="curator-alert success" role="status">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        <div className="admin-manager-content">
          {/* Grant Access Section */}
          {isUserAdmin && (
            <section className="admin-grant-section">
              <div className="admin-section-heading">
                <UserPlus size={18} />
                <h3>Grant New Access</h3>
              </div>
              <p className="admin-section-desc">
                Enter the user’s Google or sign-in email. They will receive privileges on their next catalog interaction.
              </p>

              <form onSubmit={handleGrantAccess} className="admin-grant-form">
                <div className="admin-form-row">
                  <div className="form-group flex-2">
                    <label htmlFor="grant-email">User Email *</label>
                    <input
                      id="grant-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="botanist@example.com"
                      required
                    />
                  </div>

                  <div className="form-group flex-2">
                    <label htmlFor="grant-name">Display Name (Optional)</label>
                    <input
                      id="grant-name"
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Dr. Jane Smith"
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label htmlFor="grant-role">Assigned Role</label>
                    <select
                      id="grant-role"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as "admin" | "curator")}
                    >
                      <option value="admin">Administrator (Full Access)</option>
                      <option value="curator">Curator (Flora & Photos)</option>
                    </select>
                  </div>
                </div>

                <div className="admin-grant-actions">
                  <button
                    type="submit"
                    className="curator-save-btn"
                    disabled={submitting || !newEmail.trim()}
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="spin" size={16} /> Granting…
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} /> Grant Access
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Current Curators & Admins List */}
          <section className="admin-roster-section">
            <div className="admin-section-heading between">
              <div className="flex-row items-center gap-2">
                <UserCog size={18} />
                <h3>Current Team Members ({curators.length})</h3>
              </div>
              <button
                type="button"
                className="curator-secondary-btn small"
                onClick={loadCurators}
                disabled={loading}
                title="Refresh list"
              >
                <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="curator-loading-state">
                <LoaderCircle className="spin" size={24} /> Loading access records…
              </div>
            ) : (
              <div className="admin-roster-table-wrapper">
                <table className="admin-roster-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Granted By</th>
                      <th>Date Added</th>
                      {isUserAdmin && <th className="text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {curators.map((c) => {
                      const isOwner = c.email.toLowerCase() === "niravgadhia@gmail.com";
                      const isCurrent = c.email.toLowerCase() === user.email?.toLowerCase();
                      const isBusy = busyEmail === c.email;

                      return (
                        <tr key={c.email} className={isOwner ? "row-owner" : ""}>
                          <td>
                            <div className="admin-user-cell">
                              <span className="admin-user-name">
                                {c.displayName || c.email.split("@")[0]}
                              </span>
                              <span className="admin-user-email">{c.email}</span>
                            </div>
                          </td>
                          <td>
                            {isOwner ? (
                              <span className="admin-role-badge primary-owner">
                                <Crown size={12} /> Primary Owner
                              </span>
                            ) : isUserAdmin && !isCurrent ? (
                              <select
                                className="admin-role-select"
                                value={c.role}
                                disabled={isBusy}
                                onChange={(e) =>
                                  handleRoleChange(
                                    c.email,
                                    e.target.value as "admin" | "curator",
                                    c.displayName
                                  )
                                }
                              >
                                <option value="admin">Administrator</option>
                                <option value="curator">Curator</option>
                              </select>
                            ) : (
                              <span className={`admin-role-badge ${c.role}`}>
                                {c.role === "admin" ? "Administrator" : "Curator"}
                              </span>
                            )}
                          </td>
                          <td className="admin-meta-cell">
                            {c.addedBy === "system_bootstrap"
                              ? "System Bootstrap"
                              : c.addedBy || "—"}
                          </td>
                          <td className="admin-meta-cell">
                            {c.addedAt ? new Date(c.addedAt).toLocaleDateString() : "—"}
                          </td>
                          {isUserAdmin && (
                            <td className="text-right">
                              {isOwner ? (
                                <span className="admin-protected-tag">Protected</span>
                              ) : isCurrent ? (
                                <span className="admin-protected-tag">You</span>
                              ) : (
                                <button
                                  type="button"
                                  className="curator-delete-photo-btn"
                                  onClick={() => handleRemove(c.email)}
                                  disabled={isBusy}
                                  title={`Revoke access for ${c.email}`}
                                >
                                  {isBusy ? (
                                    <LoaderCircle className="spin" size={14} />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="curator-modal-footer">
          <p className="admin-footer-note">
            Changes to administrator and curator access update immediately in Cloud Firestore security checks.
          </p>
          <button type="button" className="curator-cancel-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
