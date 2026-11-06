"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Crown,
  UserCog,
  RefreshCw,
  ArrowLeft,
  Users,
} from "lucide-react";
import type { AppUser } from "@/lib/firebase/auth-user";
import {
  CuratorRecord,
  getCuratorList,
  setCuratorRole,
  removeCurator,
  isAdmin,
} from "@/lib/curated-plants-service";

interface TeamManagementViewProps {
  user: AppUser;
  onBack: () => void;
  onGoToCatalog?: () => void;
}

export function TeamManagementView({
  user,
  onBack,
  onGoToCatalog,
}: TeamManagementViewProps) {
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
    loadCurators();
  }, []);

  async function loadCurators() {
    setLoading(true);
    setError("");
    try {
      const list = await getCuratorList();
      setCurators(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load team list.");
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

  return (
    <section className="team-page-container">
      {/* Breadcrumb / Top Bar */}
      <div className="team-page-topbar">
        <button type="button" className="text-button" onClick={onBack}>
          <ArrowLeft size={16} /> Back to dashboard
        </button>
        {onGoToCatalog && (
          <button type="button" className="text-button" onClick={onGoToCatalog}>
            View Flora Catalog →
          </button>
        )}
      </div>

      <header className="team-page-header">
        <div className="team-header-eyebrow">
          <ShieldCheck size={16} /> PLATFORM PERMISSIONS & ROLES
        </div>
        <h1>Curator & Administrator Team</h1>
        <p className="team-page-intro">
          Manage who can curate New Jersey plant profiles, verify botanical field photos, and grant platform permissions.
        </p>
      </header>

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

      {/* Grant Access Section */}
      {isUserAdmin && (
        <section className="admin-grant-section">
          <div className="admin-section-heading">
            <UserPlus size={18} />
            <h3>Add Team Member</h3>
          </div>
          <p className="admin-section-desc">
            Invite a collaborator by their sign-in email. Privileges activate automatically on their next sign-in.
          </p>

          <form onSubmit={handleGrantAccess} className="admin-grant-form">
            <div className="admin-form-row">
              <div className="form-group flex-2">
                <label htmlFor="team-grant-email">Email Address *</label>
                <input
                  id="team-grant-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  required
                />
              </div>

              <div className="form-group flex-2">
                <label htmlFor="team-grant-name">Full Name (Optional)</label>
                <input
                  id="team-grant-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Maya Chen"
                />
              </div>

              <div className="form-group flex-1">
                <label htmlFor="team-grant-role">Assigned Role</label>
                <select
                  id="team-grant-role"
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
                    <LoaderCircle className="spin" size={16} /> Adding…
                  </>
                ) : (
                  <>
                    <UserPlus size={16} /> Add Member
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Team Roster */}
      <section className="admin-roster-section">
        <div className="admin-section-heading between">
          <div className="flex-row items-center gap-2">
            <Users size={18} />
            <h3>Active Members ({curators.length})</h3>
          </div>
          <button
            type="button"
            className="curator-secondary-btn small"
            onClick={loadCurators}
            disabled={loading}
            title="Refresh roster"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="curator-loading-state">
            <LoaderCircle className="spin" size={24} /> Loading access roster…
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
    </section>
  );
}
