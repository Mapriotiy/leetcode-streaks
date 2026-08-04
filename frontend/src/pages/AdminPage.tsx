import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Ban, LogOut, RefreshCw, Search, Shield, Star } from "lucide-react";
import { apiRequest } from "../api/client";

type AdminUser = {
    id: number;
    google_sub: string | null;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
    leetcode_username: string | null;
    leetcode_verified_at: string | null;
    is_admin: boolean;
    is_banned: boolean;
    created_at: string;
};

type ListResponse = {
    total: number;
    offset: number;
    limit: number;
    users: AdminUser[];
};

const LIMIT = 50;

function formatDate(value: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
}

export function AdminPage({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = useCallback(async (search: string, pageOffset: number) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                offset: String(pageOffset),
                limit: String(LIMIT),
            });
            if (search.trim()) params.set("q", search.trim());
            const data = await apiRequest<ListResponse>(`/admin/users?${params}`);
            setUsers(data.users);
            setTotal(data.total);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load users");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(query, offset);
    }, [load, query, offset]);

    const handleSearchChange = (value: string) => {
        setQuery(value);
        setOffset(0);
    };

    const runAction = async (user: AdminUser, action: () => Promise<unknown>) => {
        setBusyId(user.id);
        setError(null);
        setSuccess(null);
        try {
            await action();
            setSuccess("Saved");
            await load(query, offset);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Action failed");
        } finally {
            setBusyId(null);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / LIMIT));
    const currentPage = Math.floor(offset / LIMIT) + 1;

    return (
        <main className="min-h-screen bg-transparent p-6 text-white">
            <div className="mx-auto max-w-6xl">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={onBack}
                            className="grid h-10 w-10 place-items-center rounded-md border border-[#3a3a3a] bg-[#262626] text-[#b3b3b3] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                                <Shield size={22} className="text-[#ffa116]" />
                                Admin
                            </h1>
                            <p className="mt-1 text-sm text-[#8a8a8a]">User management</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onLogout}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#3a3a3a] bg-[#262626] px-4 text-sm font-medium text-[#d7d7d7] transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200"
                    >
                        <LogOut size={16} />
                        Logout
                    </button>
                </header>

                {(error || success) && (
                    <p
                        className={`mt-4 rounded-md border px-3 py-2 text-sm ${
                            error
                                ? "border-red-500/30 bg-red-500/10 text-red-300"
                                : "border-[#2bff88]/30 bg-[#2bff88]/10 text-[#2bff88]"
                        }`}
                    >
                        {error ?? success}
                    </p>
                )}

                <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] shadow-xl shadow-black/20">
                    <div className="flex flex-col gap-3 border-b border-[#3a3a3a] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-xs">
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#777]" />
                            <input
                                value={query}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                placeholder="Search name, email, LeetCode…"
                                className="w-full rounded-md border border-[#3a3a3a] bg-[#1f1f1f] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-[#ffa116]/70"
                            />
                        </div>
                        <span className="text-xs text-[#8a8a8a]">
                            {total} user{total === 1 ? "" : "s"}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-[#3a3a3a] text-xs uppercase tracking-wide text-[#8a8a8a]">
                                    <th className="px-4 py-3 font-medium">User</th>
                                    <th className="px-4 py-3 font-medium">Email</th>
                                    <th className="px-4 py-3 font-medium">LeetCode</th>
                                    <th className="px-4 py-3 font-medium">Created</th>
                                    <th className="px-4 py-3 font-medium">Role</th>
                                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && users.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-[#8a8a8a]">
                                            Loading…
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-[#8a8a8a]">
                                            No users found
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => {
                                        const busy = busyId === user.id;
                                        return (
                                            <tr
                                                key={user.id}
                                                className={`border-b border-[#2a2a2a] last:border-0 ${
                                                    user.is_banned ? "bg-red-500/5 opacity-70" : ""
                                                }`}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-[#3a3a3a] bg-[#333] text-[#b3b3b3]">
                                                            {user.avatar_url ? (
                                                                <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span className="text-xs">{user.display_name?.[0] ?? "?"}</span>
                                                            )}
                                                        </span>
                                                        <div>
                                                            <p className="font-semibold text-[#eff1f6]">
                                                                {user.display_name ?? "—"}
                                                                {user.is_banned && (
                                                                    <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                                                                        BANNED
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-[#8a8a8a]">#{user.id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-[#d7d7d7]">{user.email ?? "—"}</td>
                                                <td className="px-4 py-3 text-[#d7d7d7]">
                                                    {user.leetcode_username ? (
                                                        <span className="text-[#ffa116]">{user.leetcode_username}</span>
                                                    ) : (
                                                        <span className="text-[#666]">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-[#b3b3b3]">{formatDate(user.created_at)}</td>
                                                <td className="px-4 py-3">
                                                    {user.is_admin ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ffa116]/15 px-2 py-0.5 text-[10px] font-semibold text-[#ffd08a]">
                                                            <Star size={10} />
                                                            ADMIN
                                                        </span>
                                                    ) : (
                                                        <span className="text-[#666]">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void runAction(user, () =>
                                                                    apiRequest(`/admin/users/${user.id}`, {
                                                                        method: "PATCH",
                                                                        body: JSON.stringify({ is_admin: !user.is_admin }),
                                                                    }),
                                                                )
                                                            }
                                                            title={user.is_admin ? "Revoke admin" : "Make admin"}
                                                            className={`grid h-8 w-8 place-items-center rounded-md border text-sm transition disabled:opacity-50 ${
                                                                user.is_admin
                                                                    ? "border-[#ffa116]/50 bg-[#ffa116]/10 text-[#ffa116] hover:bg-[#ffa116]/20"
                                                                    : "border-[#3a3a3a] bg-[#1f1f1f] text-[#b3b3b3] hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                                                            }`}
                                                        >
                                                            <Star size={15} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void runAction(user, () =>
                                                                    apiRequest(`/admin/users/${user.id}`, {
                                                                        method: "PATCH",
                                                                        body: JSON.stringify({ is_banned: !user.is_banned }),
                                                                    }),
                                                                )
                                                            }
                                                            title={user.is_banned ? "Unban" : "Ban"}
                                                            className={`grid h-8 w-8 place-items-center rounded-md border text-sm transition disabled:opacity-50 ${
                                                                user.is_banned
                                                                    ? "border-red-400/50 bg-red-500/15 text-red-300 hover:bg-red-500/25"
                                                                    : "border-[#3a3a3a] bg-[#1f1f1f] text-[#b3b3b3] hover:border-red-400/60 hover:text-red-300"
                                                            }`}
                                                        >
                                                            <Ban size={15} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busy || !user.leetcode_username}
                                                            onClick={() =>
                                                                void runAction(user, () =>
                                                                    apiRequest(`/admin/users/${user.id}/reset-leetcode`, { method: "POST" }),
                                                                )
                                                            }
                                                            title="Reset LeetCode link"
                                                            className="grid h-8 w-8 place-items-center rounded-md border border-[#3a3a3a] bg-[#1f1f1f] text-[#b3b3b3] transition hover:border-[#00d9ff]/60 hover:text-[#00d9ff] disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            <RefreshCw size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#3a3a3a] px-4 py-3">
                        <button
                            type="button"
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                            className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-1.5 text-sm text-[#d7d7d7] transition hover:border-[#ffa116]/60 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Prev
                        </button>
                        <span className="text-xs text-[#8a8a8a]">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={offset + LIMIT >= total}
                            onClick={() => setOffset(offset + LIMIT)}
                            className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-1.5 text-sm text-[#d7d7d7] transition hover:border-[#ffa116]/60 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}
