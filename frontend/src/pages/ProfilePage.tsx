import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Flame, LogOut, Trophy, UserCircle } from "lucide-react";
import { apiRequest } from "../api/client";
import { ActivityCalendar } from "../components/dashboard/ActivityCalendar";
import { Footer } from "../components/Footer";
import type { DashboardData } from "../types/dashboard";

type ProfilePageProps = {
    onBack: () => void;
    onLogout: () => void;
};

function StatTile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
    return (
        <div className="rounded-lg border border-[#3a3a3a] bg-[#262626] px-4 py-3 shadow-xl shadow-black/20">
            <p className="text-xs text-[#8a8a8a]">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: accent ?? "#eff1f6" }}>
                {value}
            </p>
        </div>
    );
}

export function ProfilePage({ onBack, onLogout }: ProfilePageProps) {
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setData(await apiRequest<DashboardData>("/dashboard/"));
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load profile");
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <main className="min-h-screen bg-transparent p-4 text-white sm:p-6">
            <div className="mx-auto max-w-5xl">
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
                            <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
                            <p className="mt-1 text-sm text-[#8a8a8a]">Your stats and activity</p>
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

                {error ? (
                    <p className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {error}
                    </p>
                ) : null}

                <section className="mt-6 flex flex-col items-center gap-4 rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20 sm:flex-row">
                    <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-[#3a3a3a] bg-[#333333] text-[#b3b3b3]">
                        {data?.avatar_url ? (
                            <img src={data.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <UserCircle size={40} strokeWidth={1.6} />
                        )}
                    </span>
                    <div className="min-w-0 text-center sm:text-left">
                        <p className="truncate text-xl font-semibold text-[#eff1f6]">
                            {data?.display_name ?? "—"}
                        </p>
                        {data?.leetcode_username ? (
                            <p className="mt-1 truncate text-sm text-[#ffa116]">{data.leetcode_username}</p>
                        ) : (
                            <p className="mt-1 text-sm text-[#8a8a8a]">LeetCode account not linked</p>
                        )}
                        <p className="mt-1 text-xs text-[#666]">
                            Member of MapCode
                        </p>
                    </div>
                </section>

                <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatTile
                        label="Current streak"
                        value={
                            <span className="inline-flex items-center gap-1.5">
                                <Flame size={16} className={data?.current_streak_state === "lit" ? "text-[#ffa116]" : "text-[#666]"} />
                                {data?.current_streak ?? 0}
                            </span>
                        }
                    />
                    <StatTile label="Longest streak" value={data?.longest_streak ?? 0} accent="#ffd08a" />
                    <StatTile label="Active days" value={data?.active_days_count ?? 0} />
                    <StatTile label="Solved today" value={data?.today_submissions.length ?? 0} accent="#7fe8ff" />
                    <StatTile label="Games played" value={data?.stats.games_played ?? 0} />
                    <StatTile label="Wins" value={data?.stats.games_won ?? 0} accent="#7ef7bb" />
                    <StatTile label="Win rate" value={`${data?.stats.win_rate ?? 0}%`} />
                    <StatTile label="Provinces captured" value={data?.stats.total_captures ?? 0} accent="#7fe8ff" />
                </section>

                <section className="mt-4">
                    <ActivityCalendar
                        activityCalendar={data?.activity_calendar ?? []}
                        activeDaysCount={data?.active_days_count ?? 0}
                    />
                </section>

                <div className="flex items-center gap-2 text-xs text-[#666]">
                    <Trophy size={14} />
                    <span>This profile is generated from your own LeetCode activity.</span>
                </div>

                <Footer />
            </div>
        </main>
    );
}
