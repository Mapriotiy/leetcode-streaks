import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Map as MapIcon, Trash2, UserCircle } from "lucide-react";
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
    today_submissions: {
        title: string;
        title_slug: string;
        url: string;
        submitted_at: string;
        language: string | null;
    }[];
    activity_calendar: ActivityCalendarDay[];
};

type ActivityCalendarDay = {
    date: string;
    count: number;
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
    onOpenMap: (friendshipId: number, friendUsername: string) => void;
};

function FriendFlame({
    count,
    state,
    ignite = false,
    size = "md",
}: {
    count: number;
    state: "lit" | "pending" | "broken";
    ignite?: boolean;
    size?: "md" | "lg";
}) {
    const isLit = state === "lit";
    const outerSize = size === "lg" ? "h-36 w-36" : "h-16 w-16";
    const glowSize = size === "lg" ? "h-28 w-28" : "h-12 w-12";
    const iconSize = size === "lg" ? 88 : 44;

    return (
        <div
            className={`relative grid ${outerSize} shrink-0 place-items-center overflow-hidden rounded-full border transition ${
                isLit
                    ? "border-[#ffa116]/50 bg-[#ffa116]/15 shadow-lg shadow-[#ffa116]/10"
                    : "border-[#3a3a3a] bg-[#303030]"
            }`}
        >
            {isLit ? (
                <div className={`flame-glow absolute ${glowSize} rounded-full bg-[#ffa116]/25 blur-md`} />
            ) : null}

            <Flame
                size={iconSize}
                strokeWidth={2.4}
                className={`relative transition ${
                    isLit
                        ? "fill-[#ffa116] text-[#ffd27a] drop-shadow-[0_0_10px_rgba(255,161,22,0.55)]"
                        : "fill-[#6b6b6b] text-[#8a8a8a]"
                } ${ignite ? "flame-ignite" : ""}`}
            />

            <span
                className={`absolute font-bold tabular-nums ${
                    size === "lg" ? "text-xl" : "text-sm"
                } ${
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

function getHeatmapCellClass(count: number) {
    if (count <= 0) {
        return "bg-[#333333]";
    }

    if (count === 1) {
        return "bg-[#5c431c]";
    }

    if (count <= 3) {
        return "bg-[#8f641f]";
    }

    if (count <= 6) {
        return "bg-[#c9861b]";
    }

    return "bg-[#ffa116]";
}

function formatMonthLabel(monthDate: Date) {
    return monthDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });
}

function getMonthStart(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number) {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function toDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function buildMonthHeatmapDays(
    selectedMonth: Date,
    activityCalendar: ActivityCalendarDay[],
) {
    const countsByDate = new Map(
        activityCalendar.map((day) => [day.date, day.count]),
    );
    const monthStart = getMonthStart(selectedMonth);
    const monthEnd = getMonthEnd(selectedMonth);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

    const days = [];
    const cursor = new Date(gridStart);

    while (cursor <= gridEnd) {
        const dateKey = toDateKey(cursor);

        days.push({
            date: dateKey,
            count: countsByDate.get(dateKey) ?? 0,
            isCurrentMonth: cursor.getMonth() === selectedMonth.getMonth(),
        });

        cursor.setDate(cursor.getDate() + 1);
    }

    return days;
}

export function DashboardPage({ user, refreshKey, onLogout, onOpenMap }: DashboardPageProps) {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [friends, setFriends] = useState<FriendResponse[]>([]);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
    const [isCreatingInvite, setIsCreatingInvite] = useState(false);
    const [deletingFriendshipId, setDeletingFriendshipId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);
    const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(() =>
        getMonthStart(new Date()),
    );
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
    const calendarDays = buildMonthHeatmapDays(
        selectedCalendarMonth,
        dashboardData?.activity_calendar ?? [],
    );
    const calendarWeekCount = Math.ceil(calendarDays.length / 7);
    const currentMonthStart = getMonthStart(new Date());
    const isCurrentCalendarMonth =
        selectedCalendarMonth.getFullYear() === currentMonthStart.getFullYear() &&
        selectedCalendarMonth.getMonth() === currentMonthStart.getMonth();

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

    async function handleDeleteFriend(friendshipId: number, friendUsername: string) {
        const shouldDelete = window.confirm(
            `Remove ${friendUsername} and reset this friend streak?`,
        );

        if (!shouldDelete) {
            return;
        }

        setDeletingFriendshipId(friendshipId);
        setErrorMessage(null);

        try {
            await apiRequest<void>(`/friends/${friendshipId}`, {
                method: "DELETE",
            });

            setFriends((currentFriends) =>
                currentFriends.filter((friend) => friend.friendship_id !== friendshipId),
            );
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to remove friend",
            );
        } finally {
            setDeletingFriendshipId(null);
        }
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
                            <div className="flex h-full flex-col">
                                <p className="self-start text-sm font-medium text-[#a3a3a3]">
                                    Current streak
                                </p>

                                <div className="flex flex-1 flex-col items-center justify-center text-center">
                                    <FriendFlame
                                        count={dashboardData?.current_streak ?? 0}
                                        state={currentStreakState}
                                        ignite={shouldIgniteCurrentStreak}
                                        size="lg"
                                    />

                                    <p
                                        className={`mt-4 text-xs ${
                                            isCurrentStreakLit ? "text-[#ffa116]" : "text-[#8a8a8a]"
                                        }`}
                                    >
                                        {currentStreakHint}
                                    </p>
                                </div>
                            </div>
                        </article>

                        <article className="flex flex-col rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-[#a3a3a3]">
                                        Today's solved
                                    </p>
                                    <p className="mt-1 text-xs text-[#8a8a8a]">
                                        Unique accepted problems
                                    </p>
                                </div>

                                <span className="rounded-full bg-[#333333] px-2.5 py-1 text-xs font-semibold text-[#ffa116]">
                                    {dashboardData?.today_submissions.length ?? 0}
                                </span>
                            </div>

                            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                                {!dashboardData?.today_submissions.length ? (
                                    <p className="text-sm text-[#8a8a8a]">
                                        No accepted submissions yet.
                                    </p>
                                ) : (
                                    <ul className="grid gap-2">
                                        {dashboardData.today_submissions.map((submission) => (
                                            <li key={submission.title_slug}>
                                                <a
                                                    href={submission.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="block rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm text-[#eff1f6] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                                                >
                                                    <span className="block truncate">
                                                        {submission.title}
                                                    </span>
                                                    {submission.language ? (
                                                        <span className="mt-1 block text-xs text-[#8a8a8a]">
                                                            {submission.language}
                                                        </span>
                                                    ) : null}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </article>

                        <article className="rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-[#a3a3a3]">
                                        Activity
                                    </p>
                                    <p className="mt-1 text-xs text-[#8a8a8a]">
                                        {dashboardData?.active_days_count ?? 0} active days
                                    </p>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedCalendarMonth((month) => addMonths(month, -1))
                                        }
                                        className="grid h-7 w-7 place-items-center rounded-md border border-[#3a3a3a] bg-[#333333] text-[#b3b3b3] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                                        aria-label="Previous month"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedCalendarMonth((month) => addMonths(month, 1))
                                        }
                                        disabled={isCurrentCalendarMonth}
                                        className="grid h-7 w-7 place-items-center rounded-md border border-[#3a3a3a] bg-[#333333] text-[#b3b3b3] transition hover:border-[#ffa116]/60 hover:text-[#ffa116] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#3a3a3a] disabled:hover:text-[#b3b3b3]"
                                        aria-label="Next month"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 overflow-x-auto pb-1">
                                <p className="mb-3 text-center text-xs font-medium text-[#a3a3a3]">
                                    {formatMonthLabel(selectedCalendarMonth)}
                                </p>

                                <div
                                    className="mx-auto grid w-fit grid-flow-col grid-rows-7 gap-1.5"
                                    style={{
                                        gridTemplateColumns: `repeat(${calendarWeekCount}, 1.25rem)`,
                                    }}
                                >
                                    {calendarDays.map((day) => (
                                        <div
                                            key={day.date}
                                            title={`${day.date}: ${day.count} submissions`}
                                            className={`h-4 w-4 rounded-[4px] ${
                                                day.isCurrentMonth
                                                    ? getHeatmapCellClass(day.count)
                                                    : "bg-[#202020]"
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-end gap-1 text-[11px] text-[#8a8a8a]">
                                <span className="mr-1">Less</span>
                                {[0, 1, 3, 6, 7].map((count) => (
                                    <span
                                        key={count}
                                        className={`h-2.5 w-2.5 rounded-[2px] ${getHeatmapCellClass(count)}`}
                                    />
                                ))}
                                <span className="ml-1">More</span>
                            </div>
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

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onOpenMap(
                                                            item.friendship_id,
                                                            item.friend.leetcode_username,
                                                        )
                                                    }
                                                    className="grid h-9 w-9 place-items-center rounded-md border border-[#3a3a3a] bg-[#262626] text-[#8a8a8a] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                                                    aria-label={`Open map vs ${item.friend.leetcode_username}`}
                                                    title={`Map vs ${item.friend.leetcode_username}`}
                                                >
                                                    <MapIcon size={16} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleDeleteFriend(
                                                            item.friendship_id,
                                                            item.friend.leetcode_username,
                                                        )
                                                    }
                                                    disabled={deletingFriendshipId === item.friendship_id}
                                                    className="grid h-9 w-9 place-items-center rounded-md border border-[#3a3a3a] bg-[#262626] text-[#8a8a8a] transition hover:border-red-500/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                                                    aria-label={`Remove ${item.friend.leetcode_username}`}
                                                    title={`Remove ${item.friend.leetcode_username}`}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
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
