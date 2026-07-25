import { useEffect, useState } from "react";
import { Flame, UserCircle } from "lucide-react";
import { apiRequest } from "../api/client";

type User = {
    id: number;
    leetcode_username: string;
};

type DashboardData = {
    leetcode_username: string;
    avatar_url: string | null;
    current_streak: number;
    current_streak_state: "lit" | "pending" | "broken";
    today_active: boolean;
    longest_streak: number;
    active_days_count: number;
};

type CreateInviteResponse = {
    token: string;
    invite_url: string;
};

type FriendResponse = {
    friendship_id: number;
    friend: {
        id: number;
        leetcode_username: string;
    };
    streak: {
        display_count: number;
        current_count: number;
        longest_count: number;
        state: "lit" | "pending" | "broken";
        last_shared_active_date: string | null;
        started_at: string;
        today: {
            you_active: boolean;
            friend_active: boolean;
            shared_active: boolean;
        };
    };
};

type DashboardPageProps = {
    user: User;
    refreshKey: number;
    onLogout: () => void;
};

function FriendFlame({
    count,
    state,
    ignite = false,
}: {
    count: number;
    state: "lit" | "pending" | "broken";
    ignite?: boolean;
}) {
    const isLit = state === "lit";

    return (
        <div
            className={`relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border transition ${
                isLit
                    ? "border-[#ffa116]/50 bg-[#ffa116]/15 shadow-lg shadow-[#ffa116]/10"
                    : "border-[#3a3a3a] bg-[#303030]"
            }`}
        >
            {isLit ? (
                <div className="flame-glow absolute h-12 w-12 rounded-full bg-[#ffa116]/25 blur-md" />
            ) : null}

            <Flame
                size={38}
                strokeWidth={2.4}
                className={`relative transition ${
                    isLit
                        ? "fill-[#ffa116] text-[#ffd27a] drop-shadow-[0_0_10px_rgba(255,161,22,0.55)]"
                        : "fill-[#6b6b6b] text-[#8a8a8a]"
                } ${ignite ? "flame-ignite" : ""}`}
            />

            <span
                className={`absolute text-sm font-bold tabular-nums ${
                    isLit ? "text-[#111111]" : "text-[#d6d6d6]"
                }`}
            >
                {count}
            </span>
        </div>
    );
}

function usePrevious<T>(value: T) {
    const [previous, setPrevious] = useState<T | null>(null);

    useEffect(() => {
        setPrevious(value);
    }, [value]);

    return previous;
}

export function DashboardPage({ user, refreshKey, onLogout }: DashboardPageProps) {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [friends, setFriends] = useState<FriendResponse[]>([]);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
    const [isCreatingInvite, setIsCreatingInvite] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);
    const currentStreakState = dashboardData?.current_streak_state ?? "broken";
    const isCurrentStreakLit = currentStreakState === "lit";
    const currentStreakHint =
        currentStreakState === "lit"
            ? "Active today"
            : currentStreakState === "pending"
              ? "Waiting for today's solve"
              : "Solve today to start";
    const previousCurrentStreakState = usePrevious(currentStreakState);
    const shouldIgniteCurrentStreak =
        currentStreakState === "lit" && previousCurrentStreakState !== "lit";

    useEffect(() => {
        async function loadDashboard() {
            setErrorMessage(null);

            try {
                const [dashboard, friendsList] = await Promise.all([
                    apiRequest<DashboardData>("/dashboard/"),
                    apiRequest<FriendResponse[]>("/friends/"),
                ]);

                setDashboardData(dashboard);
                setFriends(friendsList);
            } catch (error) {
                setErrorMessage(
                    error instanceof Error ? error.message : "Failed to load dashboard",
                );
            } finally {
                setIsLoadingDashboard(false);
            }
        }

        void loadDashboard();
    }, [refreshKey]);

    async function handleCreateInvite() {
        setIsCreatingInvite(true);
        setErrorMessage(null);
        setCopyMessage(null);

        try {
            const result = await apiRequest<CreateInviteResponse>("/friends/invites", {
                method: "POST",
            });

            setInviteUrl(result.invite_url);
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to create invite",
            );
        } finally {
            setIsCreatingInvite(false);
        }
    }

    async function handleCopyInvite() {
        if (!inviteUrl) {
            return;
        }

        await navigator.clipboard.writeText(inviteUrl);
        setCopyMessage("Invite link copied");
    }

    return (
        <main className="min-h-screen bg-[#1a1a1a] p-6 text-white">
            <div className="mx-auto max-w-5xl">
                <header className="flex flex-col gap-4 rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-[#3a3a3a] bg-[#333333] text-[#b3b3b3]">
                            {dashboardData?.avatar_url ? (
                                <img
                                    src={dashboardData.avatar_url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <UserCircle size={30} strokeWidth={1.8} />
                            )}
                        </div>

                        <div>
                            <p className="text-sm font-medium text-[#8a8a8a]">Logged in as</p>
                            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                                {dashboardData?.leetcode_username ?? user.leetcode_username}
                            </h1>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onLogout}
                        className="rounded-md border border-[#4a4a4a] bg-[#333333] px-4 py-2 text-sm font-medium text-[#d7d7d7] transition hover:bg-[#3d3d3d]"
                    >
                        Logout
                    </button>
                </header>

                {errorMessage ? (
                    <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {errorMessage}
                    </div>
                ) : null}

                {isLoadingDashboard ? (
                    <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                        <p className="text-sm text-[#a3a3a3]">
                            Syncing LeetCode activity...
                        </p>
                    </section>
                ) : (
                    <section className="mt-6 grid gap-4 sm:grid-cols-3">
                        <article
                            className={`rounded-lg border p-6 shadow-xl shadow-black/20 ${
                                isCurrentStreakLit
                                    ? "border-[#ffa116]/40 bg-[#ffa116]/10"
                                    : "border-[#3a3a3a] bg-[#262626]"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-[#a3a3a3]">
                                        Current streak
                                    </p>
                                    <p
                                        className={`mt-3 text-4xl font-semibold ${
                                            isCurrentStreakLit ? "text-[#ffa116]" : "text-[#b3b3b3]"
                                        }`}
                                    >
                                        {dashboardData?.current_streak ?? 0}
                                    </p>
                                    <p className="mt-2 text-sm text-[#8a8a8a]">days</p>
                                    <p
                                        className={`mt-2 text-xs ${
                                            isCurrentStreakLit ? "text-[#ffa116]" : "text-[#8a8a8a]"
                                        }`}
                                    >
                                        {currentStreakHint}
                                    </p>
                                </div>

                                <FriendFlame
                                    count={dashboardData?.current_streak ?? 0}
                                    state={currentStreakState}
                                    ignite={shouldIgniteCurrentStreak}
                                />
                            </div>
                        </article>

                        <article className="rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                            <p className="text-sm font-medium text-[#a3a3a3]">
                                Longest streak
                            </p>
                            <p className="mt-3 text-4xl font-semibold">
                                {dashboardData?.longest_streak ?? 0}
                            </p>
                            <p className="mt-2 text-sm text-[#8a8a8a]">days</p>
                        </article>

                        <article className="rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                            <p className="text-sm font-medium text-[#a3a3a3]">Active days</p>
                            <p className="mt-3 text-4xl font-semibold">
                                {dashboardData?.active_days_count ?? 0}
                            </p>
                            <p className="mt-2 text-sm text-[#8a8a8a]">total</p>
                        </article>
                    </section>
                )}

                <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Friend streaks</h2>
                            <p className="mt-2 text-sm text-[#a3a3a3]">
                                Create an invite link and send it to a friend.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleCreateInvite}
                            disabled={isCreatingInvite}
                            className="rounded-md bg-[#ffa116] px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#ffb84d] disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-[#777777]"
                        >
                            {isCreatingInvite ? "Creating..." : "Create invite link"}
                        </button>
                    </div>

                    {inviteUrl ? (
                        <div className="mt-4 rounded-lg border border-[#3a3a3a] bg-[#1f1f1f] p-3">
                            <p className="text-xs font-medium uppercase text-[#8a8a8a]">
                                Invite link
                            </p>

                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <input
                                    value={inviteUrl}
                                    readOnly
                                    className="min-w-0 flex-1 rounded-md border border-[#3a3a3a] bg-[#1a1a1a] px-3 py-2 text-sm text-white"
                                />

                                <button
                                    type="button"
                                    onClick={handleCopyInvite}
                                    className="rounded-md border border-[#4a4a4a] bg-[#333333] px-4 py-2 text-sm font-medium text-[#d7d7d7] transition hover:bg-[#3d3d3d]"
                                >
                                    Copy
                                </button>
                            </div>

                            {copyMessage ? (
                                <p className="mt-2 text-sm text-[#2cbb5d]">{copyMessage}</p>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="mt-6">
                        <h3 className="text-sm font-semibold text-[#d7d7d7]">Friends</h3>

                        {friends.length === 0 ? (
                            <p className="mt-2 text-sm text-[#8a8a8a]">No friends yet.</p>
                        ) : (
                            <ul className="mt-3 grid gap-2">
                                {friends.map((item) => {
                                    const statusText =
                                        item.streak.state === "lit"
                                            ? "Both solved today"
                                            : item.streak.state === "pending"
                                              ? "Waiting for both of you today"
                                              : "Solve today to start a shared streak";

                                    return (
                                        <li
                                            key={item.friendship_id}
                                            className="flex items-center justify-between gap-4 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-4 py-3 text-sm"
                                        >
                                            <div className="flex items-center gap-4">
                                                <FriendFlame
                                                    count={item.streak.display_count}
                                                    state={item.streak.state}
                                                    ignite={item.streak.state === "lit"}
                                                />

                                                <div>
                                                    <p className="font-semibold text-[#eff1f6]">
                                                        {item.friend.leetcode_username}
                                                    </p>
                                                    <p className="mt-1 text-[#a3a3a3]">{statusText}</p>
                                                    <p className="mt-1 text-xs text-[#8a8a8a]">
                                                        Longest shared streak: {item.streak.longest_count} days
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right text-xs text-[#8a8a8a]">
                                                <p>You: {item.streak.today.you_active ? "done" : "pending"}</p>
                                                <p>
                                                    Friend: {item.streak.today.friend_active ? "done" : "pending"}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
