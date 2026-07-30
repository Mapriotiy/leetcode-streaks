import { useCallback, useEffect, useState } from "react";
import { Gamepad2, UserCircle } from "lucide-react";
import { apiRequest } from "../api/client";
import { ActivityCalendar } from "../components/dashboard/ActivityCalendar";
import { FriendFlame } from "../components/dashboard/FriendFlame";
import { FriendsList } from "../components/dashboard/FriendsList";
import { CreateLobbyModal } from "../components/CreateLobbyModal";
import { DIFFICULTY_COLORS } from "../mapRegions";
import type { DashboardData, Faction, FriendResponse, LobbyPlayer } from "../types/dashboard";

type User = {
    id: number;
    leetcode_username: string;
};

type DashboardPageProps = {
    user: User;
    refreshKey: number;
    onLogout: () => void;
    onOpenLobby: (lobbyId: number, players?: LobbyPlayer[], factions?: Faction[]) => void;
};

const LANGUAGE_LABELS: Record<string, string> = {
    python3: "Python 3",
    cpp: "C++",
    java: "Java",
    javascript: "JavaScript",
    typescript: "TypeScript",
    csharp: "C#",
    golang: "Go",
    rust: "Rust",
};

export function DashboardPage({ user, refreshKey, onLogout, onOpenLobby }: DashboardPageProps) {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [friends, setFriends] = useState<FriendResponse[]>([]);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showLobbyModal, setShowLobbyModal] = useState(false);
    const currentStreakState = dashboardData?.current_streak_state ?? "broken";
    const isCurrentStreakLit = currentStreakState === "lit";
    const currentStreakHint =
        currentStreakState === "lit"
            ? "Active today"
            : currentStreakState === "pending"
              ? "Waiting for today's solve"
              : "Solve today to start";

    const loadDashboard = useCallback(async (showLoading = false) => {
        if (showLoading) {
            setIsLoadingDashboard(true);
        }
        setErrorMessage(null);

        try {
            const dashboard = await apiRequest<DashboardData>("/dashboard/");

            setDashboardData(dashboard);
            setFriends(dashboard.friends ?? []);
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to load dashboard",
            );
        } finally {
            setIsLoadingDashboard(false);
        }
    }, []);

    useEffect(() => {
        void loadDashboard(true);
        const refreshId = window.setTimeout(() => {
            void loadDashboard(false);
        }, 2500);
        return () => window.clearTimeout(refreshId);
    }, [loadDashboard, refreshKey]);

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
                            Loading dashboard...
                        </p>
                    </section>
                ) : (
                    <section className="mt-6 grid gap-4 sm:grid-cols-3">
                        <article className="flex flex-col rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-[#a3a3a3]">Lobby</p>
                                    <p className="mt-1 text-xs text-[#8a8a8a]">Create or rejoin games</p>
                                </div>
                                <span className="rounded-full bg-[#333333] px-2.5 py-1 text-xs font-semibold text-[#ffa116]">
                                    {dashboardData?.lobbies.length ?? 0}
                                </span>
                            </div>

                            <div className="mt-4 flex min-h-0 max-h-[13.25rem] flex-col gap-2 overflow-y-auto pr-1">
                                {!dashboardData?.lobbies.length ? (
                                    <p className="text-sm text-[#8a8a8a]">No active lobbies yet.</p>
                                ) : (
                                    dashboardData.lobbies.map((lobby) => {
                                        const isActive = lobby.status === "active";
                                        return (
                                            <button
                                                key={lobby.id}
                                                type="button"
                                                onClick={() => onOpenLobby(lobby.id, isActive ? lobby.players : undefined, lobby.factions)}
                                                className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-left text-sm transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                                            >
                                                <span className="block truncate font-medium text-[#eff1f6]">
                                                    {lobby.name}
                                                </span>
                                                <span className="mt-1 flex items-center justify-between gap-2 text-xs text-[#8a8a8a]">
                                                    <span>
                                                        {lobby.faction_mode
                                                            ? `${lobby.players.length} players, ${lobby.faction_count} factions`
                                                            : `${lobby.players.length}/${lobby.max_players} players`}
                                                        {", "}
                                                        {LANGUAGE_LABELS[lobby.programming_language] ?? lobby.programming_language}
                                                    </span>
                                                    <span className={isActive ? "text-[#ffa116]" : "text-[#a3a3a3]"}>
                                                        {isActive ? "Open map" : "Waiting"}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            <div className="mt-auto flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowLobbyModal(true)}
                                    className="mt-4 rounded-md bg-[#ffa116] px-4 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d]"
                                >
                                    <Gamepad2 size={16} className="inline-block mr-2" />
                                    Create Lobby
                                </button>
                            </div>
                        </article>

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
                    </section>
                )}

                {showLobbyModal && (
                    <CreateLobbyModal
                        username={user.leetcode_username}
                        friends={friends}
                        onClose={() => setShowLobbyModal(false)}
                        onCreated={onOpenLobby}
                    />
                )}

                <FriendsList
                    friends={friends}
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
