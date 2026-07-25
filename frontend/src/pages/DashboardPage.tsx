import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

type User = {
    id: number;
    leetcode_username: string;
};

type DashboardData = {
    leetcode_username: string;
    current_streak: number;
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
};

type DashboardPageProps = {
    user: User;
    refreshKey: number;
    onLogout: () => void;
};

export function DashboardPage({ user, refreshKey, onLogout }: DashboardPageProps) {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [friends, setFriends] = useState<FriendResponse[]>([]);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
    const [isCreatingInvite, setIsCreatingInvite] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);

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
        <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
            <div className="mx-auto max-w-5xl">
                <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500">Logged in as</p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                            {dashboardData?.leetcode_username ?? user.leetcode_username}
                        </h1>
                    </div>

                    <button
                        type="button"
                        onClick={onLogout}
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Logout
                    </button>
                </header>

                {errorMessage ? (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errorMessage}
                    </div>
                ) : null}

                {isLoadingDashboard ? (
                    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-sm text-slate-600">
                            Syncing LeetCode activity...
                        </p>
                    </section>
                ) : (
                    <section className="mt-6 grid gap-4 sm:grid-cols-3">
                        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium text-slate-500">
                                Current streak
                            </p>
                            <p className="mt-3 text-4xl font-semibold">
                                {dashboardData?.current_streak ?? 0}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">days</p>
                        </article>

                        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium text-slate-500">
                                Longest streak
                            </p>
                            <p className="mt-3 text-4xl font-semibold">
                                {dashboardData?.longest_streak ?? 0}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">days</p>
                        </article>

                        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium text-slate-500">Active days</p>
                            <p className="mt-3 text-4xl font-semibold">
                                {dashboardData?.active_days_count ?? 0}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">total</p>
                        </article>
                    </section>
                )}

                <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Friend streaks</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Create an invite link and send it to a friend.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleCreateInvite}
                            disabled={isCreatingInvite}
                            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
                        >
                            {isCreatingInvite ? "Creating..." : "Create invite link"}
                        </button>
                    </div>

                    {inviteUrl ? (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-medium uppercase text-slate-500">
                                Invite link
                            </p>

                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <input
                                    value={inviteUrl}
                                    readOnly
                                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                />

                                <button
                                    type="button"
                                    onClick={handleCopyInvite}
                                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                                >
                                    Copy
                                </button>
                            </div>

                            {copyMessage ? (
                                <p className="mt-2 text-sm text-green-700">{copyMessage}</p>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="mt-6">
                        <h3 className="text-sm font-semibold text-slate-700">Friends</h3>

                        {friends.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">No friends yet.</p>
                        ) : (
                            <ul className="mt-3 grid gap-2">
                                {friends.map((item) => (
                                    <li
                                        key={item.friendship_id}
                                        className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                                    >
                                        <span>{item.friend.leetcode_username}</span>
                                        <span className="text-slate-500">
                      Friend streak coming next
                    </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
