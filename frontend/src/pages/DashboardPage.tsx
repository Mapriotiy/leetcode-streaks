type User = {
    id: number;
    leetcode_username: string;
};

type DashboardPageProps = {
    user: User;
    onLogout: () => void;
};

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
    return (
        <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
            <div className="mx-auto max-w-5xl">
                <header className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <p className="text-sm font-medium text-slate-500">Logged in as</p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                            {user.leetcode_username}
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

                <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">Your streaks</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Friend streak tracking will appear here after we add invites.
                    </p>
                </section>
            </div>
        </main>
    );
}