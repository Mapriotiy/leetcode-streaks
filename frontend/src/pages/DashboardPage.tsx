import { useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import { apiRequest } from "../api/client";
import { ActivityCalendar } from "../components/dashboard/ActivityCalendar";
import { FriendFlame } from "../components/dashboard/FriendFlame";
import { FriendsList } from "../components/dashboard/FriendsList";
import { NotificationsBell } from "../components/dashboard/NotificationsBell";
import { DIFFICULTY_COLORS } from "../mapRegions";
import type { DashboardData, FriendResponse } from "../types/dashboard";

type User = {
    id: number;
    leetcode_username: string;
};

type DashboardPageProps = {
    user: User;
    refreshKey: number;
    onLogout: () => void;
    onOpenMap: (friendshipId: number, friendId: number, friendUsername: string) => void;
};

export function DashboardPage({ user, refreshKey, onLogout, onOpenMap }: DashboardPageProps) {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [friends, setFriends] = useState<FriendResponse[]>([]);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const currentStreakState = dashboardData?.current_streak_state ?? "broken";
    const isCurrentStreakLit = currentStreakState === "lit";
    const currentStreakHint =
        currentStreakState === "lit"
            ? "Active today"
            : currentStreakState === "pending"
              ? "Waiting for today's solve"
              : "Solve today to start";

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

    return (
        <main className="min-h-screen bg-[#1a1a1a] p-6 text-white">
            <div className="mx-auto max-w-5xl">
                <header className="flex flex-col gap-4 rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[#3a3a3a] bg-[#333333] text-[#b3b3b3]">
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

                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {dashboardData?.leetcode_username ?? user.leetcode_username}
                            </h1>
                            <FriendFlame
                                count={dashboardData?.current_streak ?? 0}
                                state={currentStreakState}
                                size="xs"
                            />
                            <span
                                className={`ml-2 text-xs ${
                                    isCurrentStreakLit ? "text-[#ffa116]" : "text-[#8a8a8a]"
                                }`}
                            >
                                {currentStreakHint}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <NotificationsBell
                            userId={user.id}
                            refreshKey={refreshKey}
                            onOpenMap={onOpenMap}
                        />

                        <button
                            type="button"
                            onClick={onLogout}
                            className="rounded-md border border-[#4a4a4a] bg-[#333333] px-4 py-2 text-sm font-medium text-[#d7d7d7] transition hover:bg-[#3d3d3d]"
                        >
                            Logout
                        </button>
                    </div>
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
                        <ActivityCalendar
                            activityCalendar={dashboardData?.activity_calendar ?? []}
                            activeDaysCount={dashboardData?.active_days_count ?? 0}
                        />

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

                            <div className="mt-4 flex min-h-0 max-h-[15rem] flex-col gap-2 overflow-y-auto pr-1">
                                {!dashboardData?.today_submissions.length ? (
                                    <p className="text-sm text-[#8a8a8a]">
                                        No accepted submissions yet.
                                    </p>
                                ) : (
                                    dashboardData.today_submissions.map((submission) => (
                                        <a
                                            key={submission.title_slug}
                                            href={submission.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block rounded-md border px-3 py-2 text-sm text-[#eff1f6] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                                            style={{
                                                borderColor: submission.difficulty
                                                    ? DIFFICULTY_COLORS[submission.difficulty] ?? "#3a3a3a"
                                                    : "#3a3a3a",
                                            }}
                                        >
                                            <span className="block truncate font-medium">
                                                {submission.title}
                                            </span>
                                            {(submission.difficulty || submission.topic_tags?.length) ? (
                                                <span className="mt-1 flex items-center gap-1.5 text-xs">
                                                    {submission.difficulty ? (
                                                        <span
                                                            className="font-medium"
                                                            style={{
                                                                color: DIFFICULTY_COLORS[submission.difficulty] ?? "#aaa",
                                                            }}
                                                        >
                                                            {submission.difficulty}
                                                        </span>
                                                    ) : null}
                                                    {(submission.topic_tags ?? []).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full bg-[#333] px-2 py-0.5 text-[#aaa]"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </span>
                                            ) : submission.language ? (
                                                <span className="mt-1 block text-xs text-[#8a8a8a]">
                                                    {submission.language}
                                                </span>
                                            ) : null}
                                        </a>
                                    ))
                                )}
                            </div>
                        </article>

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
                            </div>
                        </article>
                    </section>
                )}

                <FriendsList
                    friends={friends}
                    onOpenMap={onOpenMap}
                    onFriendRemoved={(friendshipId) =>
                        setFriends((currentFriends) =>
                            currentFriends.filter(
                                (friend) => friend.friendship_id !== friendshipId,
                            ),
                        )
                    }
                    onError={setErrorMessage}
                />
            </div>
        </main>
    );
}
