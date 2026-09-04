"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Settings, Trash2, ScrollText, Plus, Library, Pencil } from "lucide-react";
import Icon, { IconPicker } from "./Icon";
import type { UserRow, Role, CollectionRow } from "@/lib/db";

interface Props {
  users: UserRow[];
  collections: CollectionRow[];
  settings: Record<string, string>;
  currentUserId: number;
}

type SafeUser = Omit<UserRow, "password_hash">;

export default function AdminPanel({ users: initialUsers, collections: initialCollections, settings: initialSettings, currentUserId }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<SafeUser[]>(
    initialUsers.map(({ password_hash, ...rest }) => rest)
  );
  const [collections, setCollections] = useState<CollectionRow[]>(initialCollections);
  const [settings, setSettings] = useState(initialSettings);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("commentator");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState("book");

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

  function startEditingCollection(c: CollectionRow) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDescription(c.description || "");
    setEditIcon(c.icon || "book");
  }

  async function saveCollection(id: number) {
    const name = editName.trim();
    if (!name) return flashError("Collection name is required.");
    const res = await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: editDescription, icon: editIcon }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flashError(data.error || "Could not save collection.");
    setCollections((cs) => cs.map((c) => (c.id === id ? { ...c, ...data } : c)));
    setEditingId(null);
    flash("Collection saved.");
  }

  async function deleteCollection(c: CollectionRow) {
    if (!confirm(`Delete collection “${c.name}” and all its pages? This cannot be undone.`)) return;
    const res = await fetch(`/api/collections/${c.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flashError(data.error || "Delete failed.");
    setCollections((cs) => cs.filter((x) => x.id !== c.id));
    if (editingId === c.id) setEditingId(null);
    flash("Collection deleted.");
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
        <a href="#collections"><Library size={14} /> Collections</a>
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

        <section id="collections" style={{ marginTop: 48 }}>
          <h2>Collections</h2>
          <p className="sub">
            Rename collections, edit their description, or change their icon (Lucide — see{" "}
            <a href="https://lucide.dev/icons" target="_blank" rel="noreferrer" className="text-moss hover:text-moss-hover">lucide.dev/icons</a>
            {" "}for reference). Deleting a collection also removes all its pages. You can also manage collections from the Editor sidebar.
          </p>

          <table className="users">
            <thead>
              <tr><th>Collection</th><th>Icon</th><th style={{ textAlign: "right" }}>Actions</th></tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id}>
                  <td>
                    {editingId === c.id ? (
                      <div className="flex flex-col gap-2">
                        <div className="field" style={{ margin: 0 }}>
                          <label>Name</label>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div className="field" style={{ margin: 0 }}>
                          <label>Description</label>
                          <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Short description…" />
                        </div>
                        <div className="field" style={{ margin: 0 }}>
                          <label>Icon (Lucide)</label>
                          <IconPicker value={editIcon} onChange={setEditIcon} />
                        </div>
                        <div className="text-[11.5px] text-ink-muted">Slug: {c.slug} (auto-updated on rename)</div>
                      </div>
                    ) : (
                      <>
                        <b className="flex items-center gap-1.5"><Icon name={c.icon} size={14} /> {c.name}</b>
                        {c.description && (
                          <div style={{ color: "var(--ink-muted)", fontSize: 12 }}>{c.description}</div>
                        )}
                        <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>/{c.slug}</span>
                      </>
                    )}
                  </td>
                  <td>
                    <Icon name={editingId === c.id ? editIcon : c.icon} size={16} />
                    <div style={{ color: "var(--ink-muted)", fontSize: 11, marginTop: 2 }}>
                      {editingId === c.id ? editIcon || "(none)" : c.icon || "(none)"}
                    </div>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {editingId === c.id ? (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => saveCollection(c.id)}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEditingCollection(c)}>
                          <Pencil size={12} /> Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteCollection(c)}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {collections.length === 0 && (
                <tr><td colSpan={3} className="text-[13px] text-ink-muted">No collections yet — create one from the Editor.</td></tr>
              )}
            </tbody>
          </table>
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
