import { useEffect, useState } from "react";
import { ChevronRight, Flame, Gamepad2, Plus, Trophy, Users } from "lucide-react";
import { Logo } from "../components/Logo";
import { API_URL, apiRequest } from "../api/client";
import type { DashboardData, DashboardLobby, FriendResponse } from "../types/dashboard";

const MAP_BG = `${import.meta.env.BASE_URL}map-bg.webp`;

type SessionUser = {
    leetcode_username: string | null;
    display_name: string | null;
    avatar_url: string | null;
};

function GamePreviewCard({ lobby }: { lobby: DashboardLobby }) {
    const playerCount = lobby.players.length;
    const playerLabel = lobby.faction_mode
        ? `${playerCount} players · ${lobby.faction_count} factions`
        : `${playerCount} / ${lobby.max_players} players`;
    const progress = lobby.max_players > 0
        ? Math.min(100, Math.round((playerCount / lobby.max_players) * 100))
        : null;
    const thumbnailUrl = `${API_URL}/lobbies/${lobby.id}/thumbnail.png?w=480&fmt=webp&q=82`;
    const dashboardHref = window.location.pathname;

    return (
        <article className="overflow-hidden rounded-xl border border-[#3f332d] bg-[#211a16]/95">
            {lobby.status === "waiting" ? (
                <div className="flex h-36 items-center justify-center border-b border-[#3f332d] bg-[#1b1512] text-sm text-[#a8917d]">
                    Waiting for players
                </div>
            ) : (
                <img
                    src={thumbnailUrl}
                    alt={`${lobby.name} map`}
                    className="block h-36 w-full border-b border-[#3f332d] object-cover"
                    loading="lazy"
                    decoding="async"
                />
            )}
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="truncate font-black text-[#f4e7d8]">{lobby.name}</h3>
                        <p className="mt-1 text-xs text-[#a8917d]">
                            {lobby.game_mode === "team_battle" ? "Factions" : "Free for all"} · {lobby.programming_language}
                        </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-[#d9c5ad]">{lobby.status === "active" ? "In progress" : "Waiting"}</span>
                </div>
                <p className="mt-3 text-xs text-[#a8917d]">{playerLabel}</p>
                {progress != null ? (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#3b3029]">
                        <span className="block h-full rounded-full bg-[#d87a38]" style={{ width: `${progress}%` }} />
                    </div>
                ) : null}
                <a href={dashboardHref} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#4c3a31] text-sm font-black text-[#e6a15d]">
                    {lobby.status === "active" ? "Open map" : "Continue"} <ChevronRight size={15} />
                </a>
            </div>
        </article>
    );
}

function FriendPreviewRow({ friend }: { friend: FriendResponse }) {
    const name = friend.friend.leetcode_username ?? `user #${friend.friend.id}`;
    return (
        <div className="flex items-center justify-between rounded-lg bg-[#1b1512] px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#6f93a1]" />
                <span className="truncate">{name}</span>
            </span>
            <span className="shrink-0 text-xs text-[#a8917d]">{friend.streak.current_count} days</span>
        </div>
    );
}

export function MainPagePreview() {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void apiRequest<SessionUser>("/auth/me")
            .then((sessionUser) => {
                if (cancelled) return;
                setUser(sessionUser);
                return apiRequest<DashboardData>("/dashboard/");
            })
            .then((dashboard) => {
                if (!cancelled && dashboard) setData(dashboard);
            })
            .catch((reason) => {
                if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load dashboard");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (error || !user) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-[#14110f] p-6 text-center text-[#f4e7d8]">
                <div>
                    <Logo className="mx-auto text-[1.1rem]" />
                    <p className="mt-4 text-sm text-[#a8917d]">{error ? "Could not load your real dashboard." : "Log in to preview your real dashboard."}</p>
                    <a href={window.location.pathname} className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#e6a15d] px-4 text-sm font-black text-[#1d120c]">Back to dashboard</a>
                </div>
            </main>
        );
    }

    if (!data) {
        return <main className="flex min-h-[100dvh] items-center justify-center bg-[#14110f] text-sm text-[#a8917d]">Loading your real dashboard…</main>;
    }

    const activeGames = data.lobbies.slice(0, 2);
    const activeLobby = activeGames.find((lobby) => lobby.status === "active");
    const dashboardHref = window.location.pathname;
    const displayName = user.leetcode_username ?? user.display_name ?? "Player";

    return (
        <main className="min-h-[100dvh] bg-[#14110f] text-[#f4e7d8]">
            <header className="border-b border-[#3f332d] bg-[#17120f]/95">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-7">
                    <div className="flex items-center gap-8">
                        <Logo />
                        <nav className="hidden items-center gap-1 text-sm sm:flex">
                            <button type="button" className="inline-flex h-10 items-center border-b-2 border-[#d87a38] px-3 font-semibold text-[#e6a15d]">Home</button>
                            <button type="button" className="inline-flex h-10 items-center border-b-2 border-transparent px-3 font-semibold text-[#8f8278]">Lobbies</button>
                            <button type="button" className="inline-flex h-10 items-center border-b-2 border-transparent px-3 font-semibold text-[#8f8278]">Activity</button>
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="hidden max-w-40 truncate text-sm text-[#a8917d] sm:block">{displayName}</span>
                        {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-[#2f80ed] text-sm font-black text-white">{displayName.slice(0, 1).toUpperCase()}</span>}
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-8">
                <section
                    className="grid overflow-hidden rounded-2xl border border-[#4c3a31] bg-[#211a16] lg:grid-cols-[minmax(0,1fr)_18rem]"
                    style={{ backgroundImage: `linear-gradient(90deg, rgba(25,16,12,0.96), rgba(25,16,12,0.5) 58%, rgba(25,16,12,0.3)), url(${MAP_BG})`, backgroundSize: "cover", backgroundPosition: "center" }}
                >
                    <div className="relative min-h-56 overflow-hidden p-6 sm:p-8">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_32%,rgba(216,122,56,0.28),transparent_34%)]" />
                        <div className="relative max-w-xl">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d87a38]">Your next move</p>
                            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{activeLobby ? activeLobby.name : "Start your first conquest"}</h1>
                            <p className="mt-3 max-w-md text-sm leading-6 text-[#a8917d]">
                                {activeLobby ? "Your active battle is waiting. Continue where you left off." : "Create a battle and start building your territory."}
                            </p>
                            <a href={dashboardHref} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-[#e6a15d] px-5 text-sm font-black text-[#1d120c]">
                                <Gamepad2 size={17} /> {activeLobby ? "Continue battle" : "New battle"}
                            </a>
                        </div>
                    </div>
                    <aside className="border-t border-[#3f332d] bg-[#1a1411]/80 p-5 lg:border-l lg:border-t-0">
                        <div className="flex items-center gap-3">
                            <Flame size={22} className="text-[#e6a15d]" fill="currentColor" />
                            <div>
                                <strong className="block text-2xl leading-none">{data.current_streak}</strong>
                                <span className="mt-1 block text-xs text-[#a8917d]">day streak · {data.current_streak_state}</span>
                            </div>
                        </div>
                        <div className="mt-5 border-t border-[#3f332d] pt-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#756354]">Today</p>
                            <p className="mt-2 text-sm font-bold">Daily challenge</p>
                            <p className="mt-1 text-xs text-[#a8917d]">{data.today_submissions.length} problems solved</p>
                        </div>
                    </aside>
                </section>

                <section className="mt-6">
                    <div className="flex items-end justify-between gap-4">
                        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#756354]">Now</p><h2 className="mt-1 text-2xl font-black">Active games</h2></div>
                        <a href={dashboardHref} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#e6a15d] px-4 text-sm font-black text-[#1d120c]"><Plus size={16} /> New battle</a>
                    </div>
                    {activeGames.length > 0 ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{activeGames.map((lobby) => <GamePreviewCard key={lobby.id} lobby={lobby} />)}</div> : <div className="mt-4 rounded-xl border border-dashed border-[#3f332d] p-8 text-center text-sm text-[#a8917d]">No active games in your dashboard.</div>}
                </section>

                <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="rounded-xl border border-[#3f332d] bg-[#211a16]/80 p-4">
                        <div className="flex items-center gap-3"><Trophy size={18} className="text-[#f1c58e]" /><h2 className="font-black">Quick stats</h2></div>
                        <div className="mt-4 grid grid-cols-3 divide-x divide-[#3f332d] text-center">
                            <div><strong className="block text-xl">{data.active_days_count}</strong><span className="text-xs text-[#8f8278]">active days</span></div>
                            <div><strong className="block text-xl">{Math.round(data.stats.win_rate)}%</strong><span className="text-xs text-[#8f8278]">win rate</span></div>
                            <div><strong className="block text-xl">{data.stats.games_played}</strong><span className="text-xs text-[#8f8278]">games</span></div>
                        </div>
                    </div>
                    <aside className="rounded-xl border border-[#3f332d] bg-[#211a16]/80 p-4">
                        <div className="flex items-center gap-3"><Users size={18} className="text-[#f1c58e]" /><h2 className="font-black">Friend streaks</h2></div>
                        <div className="mt-3 space-y-2">{data.friends.length > 0 ? data.friends.slice(0, 3).map((friend) => <FriendPreviewRow key={friend.friendship_id} friend={friend} />) : <p className="rounded-lg bg-[#1b1512] p-3 text-sm text-[#a8917d]">No friends yet.</p>}</div>
                    </aside>
                </section>
            </div>
        </main>
    );
}
