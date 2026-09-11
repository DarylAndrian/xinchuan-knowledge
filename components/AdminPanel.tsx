"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, MoreHorizontal, Users, Settings, Trash2, ScrollText, Plus, Library, Pencil, KeyRound, Copy, Check } from "lucide-react";
import Icon, { IconPicker } from "./Icon";
import type { UserRow, Role, CollectionRow } from "@/lib/db";
import type { AccessTokenPublic, Scope } from "@/lib/tokens";

interface Props {
  users: UserRow[];
  collections: CollectionRow[];
  settings: Record<string, string>;
  currentUserId: number;
  initialTokens?: AccessTokenPublic[];
}

const SCOPE_LABELS: Record<Scope, string> = {
  "read:content": "Read published content (search, pages, collections)",
  "write:content": "Create, update, and delete pages; create collections",
  "read:comments": "Read comment threads",
  "write:comments": "Add and delete comments",
  "read:revisions": "List and restore page revisions",
  "read:drafts": "Include draft pages in reads",
  "admin:collections": "Rename/update and delete collections",
  "admin:users": "Manage users and roles",
  "admin:settings": "Read and update site settings",
};

const ALL_SCOPE_KEYS = Object.keys(SCOPE_LABELS) as Scope[];

type SafeUser = Omit<UserRow, "password_hash">;

function UserActionMenu({
  user,
  canDelete,
  onToggleSuspended,
  onDelete,
}: {
  user: SafeUser;
  canDelete: boolean;
  onToggleSuspended: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  function moveFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div className="user-action" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-action-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Actions for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={`Actions for ${user.name}`}
      >
        <MoreHorizontal size={17} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="user-action-menu"
          role="menu"
          aria-label={`Actions for ${user.name}`}
          onKeyDown={moveFocus}
        >
          <button type="button" role="menuitem" onClick={() => run(onToggleSuspended)}>
            {user.suspended ? <CircleCheck size={15} aria-hidden="true" /> : <Ban size={15} aria-hidden="true" />}
            {user.suspended ? "Reactivate user" : "Suspend user"}
          </button>
          {canDelete && (
            <button type="button" role="menuitem" className="danger" onClick={() => run(onDelete)}>
              <Trash2 size={15} aria-hidden="true" />
              Delete user
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPanel({ users: initialUsers, collections: initialCollections, settings: initialSettings, currentUserId, initialTokens = [] }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<SafeUser[]>(
    initialUsers.map(({ password_hash, ...rest }) => rest)
  );
  const [collections, setCollections] = useState<CollectionRow[]>(initialCollections);
  const [settings, setSettings] = useState(initialSettings);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("users");

  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("guest");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState("book");

  const [tokens, setTokens] = useState<AccessTokenPublic[]>(initialTokens);
  const [tokenName, setTokenName] = useState("Agent access");
  const [tokenScopes, setTokenScopes] = useState<Scope[]>([
    "read:content",
    "write:content",
    "read:comments",
    "write:comments",
    "read:revisions",
    "read:drafts",
  ]);
  const [tokenExpiry, setTokenExpiry] = useState<"0" | "30" | "90" | "365">("0");
  const [mintedToken, setMintedToken] = useState<string | null>(null);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-72px 0px -65% 0px", threshold: [0, 0.1, 0.25] }
    );
    const sections = ["users", "collections", "tokens", "settings"]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => !!section);
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const counts = {
    total: users.length,
    superadmin: users.filter((u) => u.role === "superadmin").length,
    admin: users.filter((u) => u.role === "admin").length,
    commentator: users.filter((u) => u.role === "commentator").length,
    guest: users.filter((u) => u.role === "guest").length,
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
    if (!confirm(`Delete ${u.name} (${u.username})? Their comments will be removed.`)) return;
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
      body: JSON.stringify({ name: newName, username: newUsername, password: newPassword, role: newRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flashError(data.error || "Could not create user.");
    setUsers((us) => [...us, data]);
    setNewName("");
    setNewUsername("");
    setNewPassword("");
    setNewRole("guest");
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
    role === "superadmin" ? "role-super" : role === "admin" ? "role-admin" : role === "guest" ? "role-guest" : "role-comm";

  const toggleSetting = (key: string) =>
    setSettings((s) => ({ ...s, [key]: s[key] === "1" ? "0" : "1" }));

  function toggleTokenScope(scope: Scope) {
    setTokenScopes((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]
    );
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tokenName,
        scopes: tokenScopes,
        expires_in_days: tokenExpiry === "0" ? null : Number(tokenExpiry),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flashError(data.error || "Could not create token.");
    setMintedToken(data.token);
    setMintedTokenId(data.id);
    setCopied(false);
    setTokens((ts) => [
      {
        id: data.id,
        name: data.name,
        token_prefix: data.token_prefix,
        scopes: data.scopes,
        last_used_at: data.last_used_at,
        created_at: data.created_at,
        expires_at: data.expires_at,
      },
      ...ts,
    ]);
    flash("Token created — copy it now.");
  }

  async function revokeToken(token: AccessTokenPublic) {
    if (!confirm(`Revoke token “${token.name}” (${token.token_prefix}…)? Agents using it will lose access.`)) return;
    const res = await fetch(`/api/tokens/${token.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flashError(data.error || "Revoke failed.");
    setTokens((ts) => ts.filter((t) => t.id !== token.id));
    if (mintedTokenId === token.id) {
      setMintedToken(null);
      setMintedTokenId(null);
    }
    flash("Token revoked.");
  }

  async function copyMintedToken() {
    if (!mintedToken) return;
    try {
      await navigator.clipboard.writeText(mintedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      flashError("Could not copy — select the token and copy manually.");
    }
  }

  return (
    <div className="sa-layout">
      <aside className="sa-nav">
        <div className="sb-label">Superadmin</div>
        <a
          href="#users"
          className={activeSection === "users" ? "active" : undefined}
          aria-current={activeSection === "users" ? "location" : undefined}
          onClick={() => setActiveSection("users")}
        >
          <Users size={14} /> Users &amp; Roles
        </a>
        <a
          href="#collections"
          className={activeSection === "collections" ? "active" : undefined}
          aria-current={activeSection === "collections" ? "location" : undefined}
          onClick={() => setActiveSection("collections")}
        >
          <Library size={14} /> Collections
        </a>
        <a
          href="#tokens"
          className={activeSection === "tokens" ? "active" : undefined}
          aria-current={activeSection === "tokens" ? "location" : undefined}
          onClick={() => setActiveSection("tokens")}
        >
          <KeyRound size={14} /> Access Tokens
        </a>
        <a
          href="#settings"
          className={activeSection === "settings" ? "active" : undefined}
          aria-current={activeSection === "settings" ? "location" : undefined}
          onClick={() => setActiveSection("settings")}
        >
          <Settings size={14} /> Site Settings
        </a>
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
            including other superadmins. Guests can read published pages only.
          </p>

          <div className="stat-row">
            <div className="stat"><div className="n">{counts.total}</div><div className="l">Total users</div></div>
            <div className="stat"><div className="n">{counts.superadmin}</div><div className="l">Superadmins</div></div>
            <div className="stat"><div className="n">{counts.admin}</div><div className="l">Admins</div></div>
            <div className="stat"><div className="n">{counts.commentator}</div><div className="l">Commentators</div></div>
            <div className="stat"><div className="n">{counts.guest}</div><div className="l">Guests</div></div>
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
                    <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>{u.username}</span>
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
                      <option value="guest">Guest</option>
                    </select>{" "}
                    <span className={`role-mark ${roleMark(u.role)}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`status-text ${u.suspended ? "off" : "ok"}`}>
                      {u.suspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td className="user-actions-cell">
                    <UserActionMenu
                      user={u}
                      canDelete={u.id !== currentUserId}
                      onToggleSuspended={() => patchUser(u.id, { suspended: u.suspended ? 0 : 1 })}
                      onDelete={() => deleteUser(u)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 40 }}>Create user</h2>
          <form onSubmit={createUser} className="mt-3 max-w-[520px]" style={{ borderTop: "1px solid var(--rule-strong)", paddingTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="field"><label>Name</label><input value={newName} onChange={(e) => setNewName(e.target.value)} required /></div>
              <div className="field"><label>Username</label><input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required autoComplete="off" /></div>
              <div className="field"><label>Password (6+ chars)</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} /></div>
              <div className="field">
                <label>Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                  <option value="guest">Guest</option>
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
            Rename collections, edit their description, or change their icon. The Lucide picker includes Food, Taxi, and searchable categories — see{" "}
            <a href="https://lucide.dev/icons" target="_blank" rel="noreferrer" className="text-moss hover:text-moss-hover">lucide.dev/icons</a>
            {" "}for the full catalogue. Deleting a collection also removes all its pages. You can also manage collections from the Editor sidebar.
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

        <section id="tokens" style={{ marginTop: 48 }}>
          <h2>Access Tokens</h2>
          <p className="sub">
            Personal access tokens let agents connect to the MCP endpoint at{" "}
            <code>/api/mcp</code> with <code>Authorization: Bearer &lt;token&gt;</code>.
            Choose the minimum scopes needed. Tokens are shown once at creation and can be revoked anytime.
          </p>

          {mintedToken && (
            <div className="mb-4 border border-rule-strong bg-surface p-3" style={{ maxWidth: 640 }}>
              <div className="text-[12px] font-medium mb-1">Copy this token now — it will not be shown again.</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto whitespace-nowrap text-[12px]">{mintedToken}</code>
                <button type="button" className="btn btn-ghost btn-sm" onClick={copyMintedToken}>
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={createToken} className="max-w-[640px]" style={{ borderTop: "1px solid var(--rule-strong)", paddingTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 }}>
              <div className="field"><label>Token name</label><input value={tokenName} onChange={(e) => setTokenName(e.target.value)} required /></div>
              <div className="field">
                <label>Expires</label>
                <select value={tokenExpiry} onChange={(e) => setTokenExpiry(e.target.value as typeof tokenExpiry)}>
                  <option value="0">Never</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>
            </div>
            <div className="field mt-3">
              <label>Scopes</label>
              <div className="flex flex-col gap-1.5 mt-1">
                {ALL_SCOPE_KEYS.map((scope) => (
                  <label key={scope} className="flex items-start gap-2 text-[12.5px] cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={tokenScopes.includes(scope)}
                      onChange={() => toggleTokenScope(scope)}
                    />
                    <span>
                      <code>{scope}</code>
                      <span style={{ color: "var(--ink-muted)" }}> — {SCOPE_LABELS[scope]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <button className="btn btn-primary mt-3"><KeyRound size={13} /> Create token</button>
          </form>

          <table className="users" style={{ marginTop: 24 }}>
            <thead>
              <tr>
                <th>Token</th>
                <th>Scopes</th>
                <th>Last used</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.name}</b>
                    <br />
                    <code style={{ color: "var(--ink-muted)", fontSize: 12 }}>{t.token_prefix}…</code>
                    {t.expires_at && t.expires_at < Date.now() && (
                      <span className="role-mark role-guest" style={{ marginLeft: 6 }}>expired</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {t.scopes.map((s) => (
                      <div key={s}><code>{s}</code></div>
                    ))}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    {t.last_used_at || "Never"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-danger btn-sm" onClick={() => revokeToken(t)}>Revoke</button>
                  </td>
                </tr>
              ))}
              {tokens.length === 0 && (
                <tr><td colSpan={4} className="text-[13px] text-ink-muted">No tokens yet.</td></tr>
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
            <div className="switch-row" style={{ cursor: "default" }}>
              Sign-in required — visitors without an account are sent to the login page
              <button className="switch" disabled aria-label="Sign-in required" title="Always on" />
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
