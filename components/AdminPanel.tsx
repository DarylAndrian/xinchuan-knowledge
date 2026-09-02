"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Settings, Trash2, ScrollText, Plus } from "lucide-react";
import type { UserRow, Role } from "@/lib/db";

interface Props {
  users: UserRow[];
  settings: Record<string, string>;
  currentUserId: number;
}

type SafeUser = Omit<UserRow, "password_hash">;

export default function AdminPanel({ users: initialUsers, settings: initialSettings, currentUserId }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<SafeUser[]>(
    initialUsers.map(({ password_hash, ...rest }) => rest)
  );
  const [settings, setSettings] = useState(initialSettings);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("commentator");

  const counts = {
    total: users.length,
    superadmin: users.filter((u) => u.role === "superadmin").length,
    admin: users.filter((u) => u.role === "admin").length,
    commentator: users.filter((u) => u.role === "commentator").length,
  };

  function flash(msg: string) {
    setNotice(msg);
    setError(null);
    setTimeout(() => setNotice(null), 2500);
  }
  function flashError(msg: string) {
    setError(msg);
    setNotice(null);
  }

  async function patchUser(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flashError(data.error || "Update failed.");
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, ...data } : u)));
    flash("Saved.");
  }

  async function deleteUser(u: SafeUser) {
    if (!confirm(`Delete ${u.name} (${u.email})? Their comments will be removed.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flashError(data.error || "Delete failed.");
    setUsers((us) => us.filter((x) => x.id !== u.id));
    flash("User deleted.");
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flashError(data.error || "Could not create user.");
    setUsers((us) => [...us, data]);
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("commentator");
    flash("User created.");
  }

  async function saveSettings() {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) return flashError("Could not save settings.");
    flash("Settings saved.");
    router.refresh(); // refresh site name in the top bar
  }

  const roleMark = (role: Role) =>
    role === "superadmin" ? "role-super" : role === "admin" ? "role-admin" : "role-comm";

  const toggleSetting = (key: string) =>
    setSettings((s) => ({ ...s, [key]: s[key] === "1" ? "0" : "1" }));

  return (
    <div className="sa-layout">
      <aside className="sa-nav">
        <div className="sb-label">Superadmin</div>
        <a href="#users" className="active"><Users size={14} /> Users &amp; Roles</a>
        <a href="#settings"><Settings size={14} /> Site Settings</a>
        <a href="#users"><Trash2 size={14} /> Moderation</a>
        <a href="#users"><ScrollText size={14} /> Audit Log</a>
      </aside>

      <main className="sa-main">
        {notice && <div className="mb-4 border-l-2 border-moss bg-surface px-4 py-2 text-[13px]">{notice}</div>}
        {error && <div className="mb-4 border-l-2 border-brick bg-surface px-4 py-2 text-[13px] text-brick">{error}</div>}

        <section id="users">
          <h2>Users &amp; Roles</h2>
          <p className="sub">
            Create accounts, assign roles and manage access. Superadmins can manage everything,
            including other superadmins.
          </p>

          <div className="stat-row">
            <div className="stat"><div className="n">{counts.total}</div><div className="l">Total users</div></div>
            <div className="stat"><div className="n">{counts.superadmin}</div><div className="l">Superadmins</div></div>
            <div className="stat"><div className="n">{counts.admin}</div><div className="l">Admins</div></div>
            <div className="stat"><div className="n">{counts.commentator}</div><div className="l">Commentators</div></div>
          </div>

          <table className="users">
            <thead>
              <tr><th>User</th><th>Role</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    <br />
                    <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>{u.email}</span>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => patchUser(u.id, { role: e.target.value })}
                      className="rounded border border-rule-strong bg-canvas px-2 py-1 text-[12.5px]"
                    >
                      <option value="superadmin">Superadmin</option>
                      <option value="admin">Admin</option>
                      <option value="commentator">Commentator</option>
                    </select>{" "}
                    <span className={`role-mark ${roleMark(u.role)}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`status-text ${u.suspended ? "off" : "ok"}`}>
                      {u.suspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => patchUser(u.id, { suspended: u.suspended ? 0 : 1 })}
                    >
                      {u.suspended ? "Reactivate" : "Suspend"}
                    </button>
                    {u.id !== currentUserId && (
                      <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 40 }}>Create user</h2>
          <form onSubmit={createUser} className="mt-3 max-w-[520px]" style={{ borderTop: "1px solid var(--rule-strong)", paddingTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="field"><label>Name</label><input value={newName} onChange={(e) => setNewName(e.target.value)} required /></div>
              <div className="field"><label>Email</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required /></div>
              <div className="field"><label>Password (6+ chars)</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} /></div>
              <div className="field">
                <label>Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                  <option value="commentator">Commentator</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary"><Plus size={13} /> Create user</button>
          </form>
        </section>

        <section id="settings" style={{ marginTop: 48 }}>
          <h2>Site Settings</h2>
          <p className="sub">Global configuration applied across the knowledge center.</p>
          <div className="max-w-[520px]" style={{ borderTop: "1px solid var(--rule-strong)" }}>
            <div className="field" style={{ marginTop: 16 }}>
              <label>Site name</label>
              <input value={settings.site_name} onChange={(e) => setSettings((s) => ({ ...s, site_name: e.target.value }))} />
            </div>
            <div className="switch-row">
              Public viewing — anonymous visitors can read published pages
              <button className={`switch ${settings.public_viewing === "1" ? "" : "off"}`} onClick={() => toggleSetting("public_viewing")} aria-label="Public viewing" />
            </div>
            <div className="switch-row">
              Allow open registration
              <button className={`switch ${settings.open_registration === "1" ? "" : "off"}`} onClick={() => toggleSetting("open_registration")} aria-label="Open registration" />
            </div>
            <div className="switch-row">
              Require approval for new commentators
              <button className={`switch ${settings.comment_approval === "1" ? "" : "off"}`} onClick={() => toggleSetting("comment_approval")} aria-label="Comment approval" />
            </div>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={saveSettings}>
              Save settings
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
