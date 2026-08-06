import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Activity,
    Check,
    ChevronRight,
    Copy,
    Crown,
    Flame,
    Gamepad2,
    Home,
    LogOut,
    Shield,
    Swords,
    Target,
    Trophy,
    UserPlus,
    Users,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { apiRequest } from "../api/client";
import { LobbyPage } from "./LobbyPage";
import { LobbyGamePage } from "./LobbyGamePage";
import type { DashboardData, DashboardLobby, Faction, LobbyPlayer } from "../types/dashboard";

const MAP_BG = `${import.meta.env.BASE_URL}maps/leet_background.webp`;

type User = {
    id: number;
    leetcode_username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    leetcode_verified_at: string | null;
    is_admin?: boolean;
};

type CreateLobbyResponse = {
    lobby: { id: number; players: LobbyPlayer[]; factions: Faction[]; status: string };
    invite_url: string;
};

type CreateInviteResponse = {
    token: string;
    invite_url: string;
};

const navItems = [
    { label: "Home", icon: Home, active: true },
    { label: "Lobbies", icon: Gamepad2 },
    { label: "Activity", icon: Activity },
    { label: "Leaderboard", icon: Trophy },
    { label: "Challenges", icon: Target },
];

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

const LOBBY_ACCENTS = ["#d87a38", "#6f93a1", "#9d6b93", "#8fa66f", "#b86a3a", "#5b8a72"];
const FRIEND_COLORS = ["#6f93a1", "#d87a38", "#9d6b93", "#8fa66f", "#5b8a72", "#b86a3a"];

function SkeletonBlock({ className = "" }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded-md bg-[linear-gradient(90deg,#211a16,#342820,#211a16)] bg-[length:220%_100%] ${className}`}
        />
    );
}

function MainPageSkeleton() {
    return (
        <motion.main
            className="min-h-screen bg-[#14110f] text-[#f4e7d8]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
        >
            <header className="sticky top-0 z-30 border-b border-[#2b231f] bg-[#11100e]/94 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-7">
                    <Logo className="text-[1.1rem]" />
                    <div className="hidden items-center gap-2 lg:flex">
                        <SkeletonBlock className="h-6 w-20" />
                        <SkeletonBlock className="h-6 w-24" />
                        <SkeletonBlock className="h-6 w-20" />
                    </div>
                    <div className="flex items-center gap-3">
                        <SkeletonBlock className="h-10 w-32" />
                        <SkeletonBlock className="h-10 w-36" />
                        <SkeletonBlock className="h-10 w-10" />
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-7 py-3">
                <DashboardBodySkeleton />
            </div>
        </motion.main>
    );
}

function DashboardBodySkeleton() {
    return (
        <motion.div
            key="dashboard-skeleton"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
        >
            <section className="grid min-h-[9.5rem] grid-cols-[13rem_minmax(0,1fr)_14rem] gap-5 overflow-hidden rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-3 shadow-2xl shadow-black/30">
                <SkeletonBlock className="h-full min-h-[8rem]" />
                <div className="grid grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] gap-5">
                    <div className="flex flex-col justify-center px-1">
                        <SkeletonBlock className="h-7 w-56" />
                        <SkeletonBlock className="mt-3 h-4 w-72" />
                        <SkeletonBlock className="mt-5 h-12 w-full" />
                        <SkeletonBlock className="mt-3 h-2 w-full" />
                    </div>
                    <SkeletonBlock className="h-full min-h-[8rem]" />
                </div>
                <div className="rounded-lg border border-[#3f332d] bg-[#1c1613]/86 p-3">
                    <SkeletonBlock className="h-10 w-full" />
                    <SkeletonBlock className="mt-3 h-10 w-full" />
                    <SkeletonBlock className="mt-3 h-10 w-full" />
                </div>
            </section>

            <section className="mt-3 grid grid-cols-[minmax(0,1fr)_23.5rem] gap-3">
                <div className="rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-3 shadow-xl shadow-black/25">
                    <SkeletonBlock className="h-8 w-52" />
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <SkeletonBlock className="h-52" />
                        <SkeletonBlock className="h-52" />
                    </div>
                    <SkeletonBlock className="mt-2 h-[4.5rem]" />
                </div>

                <aside className="rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-3 shadow-xl shadow-black/25">
                    <SkeletonBlock className="h-8 w-44" />
                    <SkeletonBlock className="mt-3 h-12 w-full" />
                    <SkeletonBlock className="mt-2 h-12 w-full" />
                    <SkeletonBlock className="mt-2 h-12 w-full" />
                    <SkeletonBlock className="mt-2 h-10 w-full" />
                </aside>
            </section>
        </motion.div>
    );
}

function NavItem({ item }: { item: (typeof navItems)[number] }) {
    const Icon = item.icon;

    return (
        <button
            type="button"
            className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${
                item.active
                    ? "border-[#d87a38] text-[#e6a15d]"
                    : "border-transparent text-[#8f8278] hover:text-[#f1dfc8]"
            }`}
        >
            <Icon size={16} />
            {item.label}
        </button>
    );
}

function MapPreview() {
    return (
        <div
            className="relative h-full min-h-[5rem] overflow-hidden rounded-md border border-[#3f332d] bg-[#191410]"
            style={{
                backgroundImage: `linear-gradient(rgba(20, 15, 12, 0.12), rgba(20, 15, 12, 0.22)), url(${MAP_BG})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
        >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,15,12,0.28),transparent_30%,transparent_70%,rgba(20,15,12,0.32))]" />
        </div>
    );
}

function GameCard({
    lobby,
    index,
    onOpen,
}: {
    lobby: DashboardLobby;
    index: number;
    onOpen: (lobby: DashboardLobby) => void;
}) {
    const accent = LOBBY_ACCENTS[index % LOBBY_ACCENTS.length];
    const playerCount = lobby.players.length;
    const slotLabel = lobby.faction_mode
        ? `${playerCount} players, ${lobby.faction_count} factions`
        : `${playerCount} / ${lobby.max_players} players`;
    const statusLabel = lobby.status === "active" ? "In progress" : lobby.status === "finished" ? "Finished" : "Waiting";
    const progress = lobby.faction_mode ? 45 : Math.min(100, Math.round((playerCount / Math.max(1, lobby.max_players)) * 100));

    return (
        <article className="rounded-lg border border-[#3f332d] bg-[#211a16]/88 p-3 shadow-xl shadow-black/20">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-md border bg-[#2b211c]"
                        style={{ borderColor: `${accent}80`, color: accent }}
                    >
                        <Shield size={22} />
                    </span>
                    <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-[#f4e7d8]">{lobby.name}</h3>
                        <p className="mt-1 text-xs text-[#a8917d]">Status: {statusLabel}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onOpen(lobby)}
                    className="h-9 shrink-0 rounded-md border border-[#4c3a31] px-3 text-xs font-bold text-[#e6a15d] transition hover:border-[#d87a38]"
                >
                    {lobby.status === "active" ? "Open map" : "Continue"}
                </button>
            </div>

            <div className="mt-2 grid grid-cols-[1fr_7.5rem] gap-3">
                <MapPreview />
                <div className="rounded-md border border-[#3f332d] bg-[#1b1512]/88 p-2 text-xs text-[#a8917d]">
                    <p className="font-semibold text-[#d9c5ad]">{slotLabel}</p>
                    <p className="mt-2">Language: {LANGUAGE_LABELS[lobby.programming_language] ?? lobby.programming_language}</p>
                    <p className="mt-3">Mode</p>
                    <p className="mt-1 font-semibold text-[#d9c5ad]">
                        {lobby.game_mode === "team_battle" ? "Factions" : "Free for all"}
                    </p>
                </div>
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs text-[#a8917d]">
                <span>Slots</span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-[#3b3029]">
                    <span
                        className="block h-full rounded-full"
                        style={{ width: `${progress}%`, backgroundColor: accent }}
                    />
                </span>
                <strong className="text-[#e6a15d]">{slotLabel.split(" ")[0]}</strong>
            </div>
        </article>
    );
}

function FriendRow({ friend }: { friend: { name: string; streak: number; color: string } }) {
    return (
        <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-md border border-[#3f332d] bg-[#211a16]/88 px-3 py-2 text-left transition hover:border-[#7d4d32]"
        >
            <span className="flex min-w-0 items-center gap-3">
                <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-black text-[#17110e]"
                    style={{ backgroundColor: `${friend.color}dd`, borderColor: friend.color }}
                >
                    {friend.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                    <strong className="block truncate text-sm text-[#f4e7d8]">{friend.name}</strong>
                    <span className="mt-1 block truncate text-xs text-[#a8917d]">Longest streak: {friend.streak} days</span>
                </span>
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-black text-[#f1c58e]">
                <Flame size={15} fill="currentColor" />
                {friend.streak}
                <ChevronRight size={15} className="text-[#756354]" />
            </span>
        </button>
    );
}

function MetricItem({
    icon: Icon,
    value,
    label,
    color,
}: {
    icon: typeof Swords;
    value: string;
    label: string;
    color: string;
}) {
    return (
        <div className="flex min-w-0 items-center gap-2.5 px-1.5">
            <Icon size={20} style={{ color }} className="shrink-0" />
            <div className="min-w-0">
                <strong className="block text-lg text-[#f4e7d8]">{value}</strong>
                <p className="mt-0.5 truncate text-xs text-[#a8917d]" title={label}>
                    {label}
                </p>
            </div>
        </div>
    );
}

type NavState = {
    screen: "lobby" | "game";
    lobbyId: number;
    players?: LobbyPlayer[];
    factions?: Faction[];
};

export function MainPage() {
    const [user, setUser] = useState<User | null>(null);
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [screen, setScreen] = useState<"dashboard" | "lobby" | "game">("dashboard");
    const [activeLobbyId, setActiveLobbyId] = useState<number | null>(null);
    const [activePlayers, setActivePlayers] = useState<LobbyPlayer[]>([]);
    const [activeFactions, setActiveFactions] = useState<Faction[]>([]);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [isCreatingInvite, setIsCreatingInvite] = useState(false);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);
    const navDepthRef = useRef(0);

    useEffect(() => {
        apiRequest<User>("/auth/me")
            .then(setUser)
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!user) return;
        apiRequest<DashboardData>("/dashboard/")
            .then(setDashboardData)
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"));
    }, [user]);

    const applyNavState = useCallback((state: NavState | null) => {
        if (state && (state.screen === "lobby" || state.screen === "game")) {
            setScreen(state.screen);
            setActiveLobbyId(state.lobbyId);
            setActivePlayers(state.players ?? []);
            setActiveFactions(state.factions ?? []);
        } else {
            setScreen("dashboard");
            setActiveLobbyId(null);
            setActivePlayers([]);
            setActiveFactions([]);
        }
    }, []);

    const pushNav = useCallback(
        (state: NavState) => {
            navDepthRef.current += 1;
            window.history.pushState(state, "");
            applyNavState(state);
        },
        [applyNavState],
    );

    useEffect(() => {
        const onPopState = (event: PopStateEvent) => {
            navDepthRef.current = Math.max(0, navDepthRef.current - 1);
            applyNavState(event.state as NavState | null);
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [applyNavState]);

    const goDashboard = useCallback(() => {
        if (navDepthRef.current > 0) {
            window.history.back();
        } else {
            applyNavState(null);
        }
    }, [applyNavState]);

    const openLobby = useCallback(
        (lobby: DashboardLobby) => {
            pushNav({
                screen: lobby.status === "active" ? "game" : "lobby",
                lobbyId: lobby.id,
                players: lobby.players,
                factions: lobby.factions,
            });
        },
        [pushNav],
    );

    const handleGameStarted = useCallback(
        (lobbyId: number, players: LobbyPlayer[], factions: Faction[]) => {
            pushNav({ screen: "game", lobbyId, players, factions });
        },
        [pushNav],
    );

    const handleLogout = useCallback(() => {
        localStorage.removeItem("accessToken");
        setUser(null);
        setDashboardData(null);
        setScreen("dashboard");
        setInviteUrl(null);
    }, []);

    const createLobby = useCallback(async () => {
        setError(null);
        try {
            const res = await apiRequest<CreateLobbyResponse>("/lobbies/", {
                method: "POST",
                body: JSON.stringify({
                    name: "New Expedition",
                    game_mode: "free_for_all",
                    map_size: "medium",
                    max_players: 2,
                    programming_language: "python3",
                }),
            });
            setActiveLobbyId(res.lobby.id);
            setActivePlayers(res.lobby.players);
            setActiveFactions(res.lobby.factions);
            pushNav({
                screen: res.lobby.status === "active" ? "game" : "lobby",
                lobbyId: res.lobby.id,
                players: res.lobby.players,
                factions: res.lobby.factions,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create lobby");
        }
    }, [pushNav]);

    const createInvite = useCallback(async () => {
        setIsCreatingInvite(true);
        setError(null);
        setCopyMessage(null);
        try {
            const res = await apiRequest<CreateInviteResponse>("/friends/invites", { method: "POST" });
            setInviteUrl(res.invite_url);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create invite");
        } finally {
            setIsCreatingInvite(false);
        }
    }, []);

    const copyInvite = useCallback(async () => {
        if (!inviteUrl) return;
        await navigator.clipboard.writeText(inviteUrl);
        setCopyMessage("Copied");
        window.setTimeout(() => setCopyMessage(null), 2000);
    }, [inviteUrl]);

    if (loading) {
        return <MainPageSkeleton />;
    }

    if (!user) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#14110f] p-6 text-center text-[#f4e7d8]">
                <Logo className="text-[1.4rem]" />
                <p className="max-w-md text-sm leading-6 text-[#a8917d]">
                    Log in to see your campaign table, live lobbies and friend streaks.
                </p>
                <button
                    type="button"
                    onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.delete("mainPreview");
                        window.location.href = url.toString();
                    }}
                    className="rounded-lg bg-[linear-gradient(180deg,#e6a15d,#c76f32)] px-6 py-3 text-sm font-black text-[#1d120c] shadow-lg shadow-[#8a3e22]/25"
                >
                    Log in
                </button>
            </main>
        );
    }

    let content: ReactNode;

    if (screen === "game" && activeLobbyId != null) {
        content = (
            <LobbyGamePage
                lobbyId={activeLobbyId}
                currentUserId={user.id}
                players={activePlayers}
                factions={activeFactions}
                isAdmin={Boolean(user.is_admin)}
                onBack={goDashboard}
                onReplay={() => {
                    window.location.href = `${window.location.pathname}?replay=${activeLobbyId}`;
                }}
                onLeft={goDashboard}
            />
        );
    } else if (screen === "lobby" && activeLobbyId != null) {
        content = (
            <LobbyPage
                lobbyId={activeLobbyId}
                currentUserId={user.id}
                currentUserVerified={user.leetcode_verified_at != null}
                onBack={goDashboard}
                onGameStarted={handleGameStarted}
            />
        );
    } else {

    const lobbies = dashboardData?.lobbies ?? [];
    const friends = dashboardData?.friends ?? [];
    const metrics = [
        { label: "Active days", value: String(dashboardData?.active_days_count ?? 0), icon: Swords, color: "#f1c58e" },
        { label: "Territories captured", value: String(dashboardData?.stats?.total_captures ?? 0), icon: Crown, color: "#d87a38" },
        { label: "Games played", value: String(dashboardData?.stats?.games_played ?? 0), icon: Gamepad2, color: "#e6a15d" },
        { label: "Win rate", value: `${Math.round(dashboardData?.stats?.win_rate ?? 0)}%`, icon: Target, color: "#b86a3a" },
    ];
    const isDashboardLoading = !dashboardData && !error;

    content = (
        <main className="min-h-screen bg-[#14110f] text-[#f4e7d8]">
            <header className="sticky top-0 z-30 border-b border-[#2b231f] bg-[#11100e]/94 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-7">
                    <Logo className="text-[1.1rem]" />

                    <nav className="hidden items-center gap-2 lg:flex">
                        {navItems.map((item) => (
                            <NavItem key={item.label} item={item} />
                        ))}
                    </nav>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="flex h-10 items-center gap-3 rounded-lg border border-[#3f332d] bg-[#24201c] px-3 text-sm font-bold text-[#f4e7d8] shadow-lg shadow-black/20"
                        >
                            <span className="relative h-7 w-7 rounded-full bg-[linear-gradient(135deg,#7b5b46,#d1a77f)]">
                                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[#24201c] bg-[#79a85e]" />
                            </span>
                            {user.leetcode_username ?? user.display_name ?? "Player"}
                        </button>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="grid h-10 w-10 place-items-center rounded-lg border border-[#3f332d] bg-[#24201c] text-[#d9c5ad]"
                            aria-label="Log out"
                            title="Log out"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-7 py-3">
                <AnimatePresence mode="wait" initial={false}>
                    {isDashboardLoading ? (
                        <DashboardBodySkeleton />
                    ) : (
                        <motion.div
                            key="dashboard-content"
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                        >
                <section className="grid min-h-[9.5rem] grid-cols-[13rem_minmax(0,1fr)_14rem] gap-5 overflow-hidden rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-3 shadow-2xl shadow-black/30">
                    <div
                        className="relative overflow-hidden rounded-md border border-[#3f332d] bg-[#17120f]"
                        style={{
                            backgroundImage: `linear-gradient(rgba(17,13,10,0.28), rgba(17,13,10,0.4)), url(${MAP_BG})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                        }}
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,13,10,0.2),transparent_35%,transparent_65%,rgba(17,13,10,0.42))]" />
                    </div>

                    <div className="grid grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] gap-5">
                        <div className="flex flex-col justify-center px-1">
                            <h1 className="text-2xl font-black leading-none text-[#f4e7d8] md:text-3xl">
                                Today's conquest
                            </h1>
                            <p className="mt-2 max-w-xl text-sm leading-5 text-[#a8917d]">
                                Solve problems. Capture territories. Grow your empire.
                            </p>

                            <div className="mt-3 flex items-center gap-4">
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#7d4d32] bg-[#33241b] text-[#e6a15d] shadow-lg shadow-[#8a3e22]/20">
                                    <Flame size={21} fill="currentColor" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <strong className="block text-sm">Daily challenge</strong>
                                            <span className="mt-0.5 block text-xs text-[#a8917d]">Solve today to claim your territory.</span>
                                        </div>
                                        <span className="text-sm text-[#a8917d]">
                                            {dashboardData?.today_submissions.length ?? 0} solved today
                                        </span>
                                    </div>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full border border-[#3f332d] bg-[#191410]">
                                        <span className="block h-full w-full rounded-full bg-[linear-gradient(90deg,#d87a38,#e6a15d)]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <MapPreview />
                    </div>

                    <aside className="rounded-lg border border-[#3f332d] bg-[#1c1613]/86 p-3">
                        <div className="flex items-center gap-3 border-b border-[#3f332d] pb-3">
                            <Flame size={26} className="text-[#e6a15d]" fill="currentColor" />
                            <div>
                                <strong className="block text-xl leading-none">{dashboardData?.current_streak ?? 0}</strong>
                                <span className="mt-1 block text-xs text-[#a8917d]">
                                    day streak - {dashboardData?.current_streak_state ?? "broken"}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 border-b border-[#3f332d] py-3">
                            <Crown size={25} className="text-[#f1c58e]" />
                            <div>
                                <strong className="block text-xl leading-none">{dashboardData?.longest_streak ?? 0}</strong>
                                <span className="mt-1 block text-xs text-[#a8917d]">longest streak ever</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="mt-3 h-10 w-full rounded-lg border border-[#4c3a31] bg-[#2b211c] text-sm font-black text-[#a8917d]"
                        >
                            Start solving
                        </button>
                    </aside>
                </section>

                <section className="mt-3 grid grid-cols-[minmax(0,1fr)_23.5rem] gap-3">
                    <div className="rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-3 shadow-xl shadow-black/25">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-start gap-3">
                                <Users size={22} className="mt-0.5 text-[#f1c58e]" />
                                <div>
                                    <h2 className="text-lg font-black">Active games</h2>
                                    <p className="mt-1 text-sm text-[#a8917d]">Your ongoing conquests</p>
                                </div>
                                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#34271f] px-2 text-xs font-bold text-[#f1c58e]">
                                    {lobbies.length}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => void createLobby()}
                                className="h-9 shrink-0 rounded-lg bg-[linear-gradient(180deg,#e6a15d,#c76f32)] px-4 text-sm font-black text-[#1d120c] shadow-lg shadow-[#8a3e22]/25"
                            >
                                New Battle
                            </button>
                        </div>

                        {lobbies.length > 0 ? (
                            <div className="grid gap-3 md:grid-cols-2">
                                {lobbies.map((lobby, index) => (
                                    <GameCard key={lobby.id} lobby={lobby} index={index} onOpen={openLobby} />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-md border border-dashed border-[#3f332d] bg-[#1b1512]/88 p-6 text-center text-sm text-[#a8917d]">
                                No games yet. Start your first expedition.
                            </div>
                        )}

                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-3 rounded-lg border border-[#3f332d] bg-[#1b1512]/88 px-3 py-2.5 md:grid-cols-4">
                            {metrics.map((metric) => (
                                <MetricItem key={metric.label} icon={metric.icon} value={metric.value} label={metric.label} color={metric.color} />
                            ))}
                        </div>
                    </div>

                    <aside className="rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-3 shadow-xl shadow-black/25">
                        <div className="mb-3 flex items-start gap-3">
                            <Flame size={20} className="mt-0.5 text-[#e6a15d]" fill="currentColor" />
                            <div>
                                <h2 className="text-base font-black">Friend streaks</h2>
                                <p className="mt-1 text-sm text-[#a8917d]">Your allies, your rivals</p>
                            </div>
                        </div>

                        <div className="grid gap-1.5">
                            {friends.length > 0 ? (
                                friends.map((friend, index) => (
                                    <FriendRow
                                        key={friend.friendship_id}
                                        friend={{
                                            name: friend.friend.leetcode_username ?? `user #${friend.friend.id}`,
                                            streak: friend.streak.current_count ?? friend.streak.longest_count ?? 0,
                                            color: FRIEND_COLORS[index % FRIEND_COLORS.length],
                                        }}
                                    />
                                ))
                            ) : (
                                <p className="rounded-md border border-dashed border-[#3f332d] bg-[#1b1512]/88 p-4 text-center text-sm text-[#a8917d]">
                                    No friends yet. Invite someone to your table.
                                </p>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => void createInvite()}
                            disabled={isCreatingInvite}
                            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#3f332d] bg-[#1b1512] text-sm font-black text-[#e6a15d] transition hover:border-[#7d4d32] disabled:cursor-not-allowed disabled:text-[#756354]"
                        >
                            <UserPlus size={17} />
                            {isCreatingInvite ? "Creating..." : "Invite a friend"}
                        </button>

                        {inviteUrl ? (
                            <div className="mt-3 rounded-md border border-[#3f332d] bg-[#1b1512]/88 p-3">
                                <p className="text-xs font-semibold text-[#f1c58e]">Invite link</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        readOnly
                                        value={inviteUrl}
                                        className="min-w-0 flex-1 rounded-md border border-[#3f332d] bg-[#191410] px-2 py-1.5 text-xs text-[#d9c5ad]"
                                        onFocus={(e) => e.currentTarget.select()}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void copyInvite()}
                                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#4c3a31] text-[#e6a15d] transition hover:border-[#d87a38]"
                                        aria-label="Copy invite link"
                                    >
                                        {copyMessage ? <Check size={15} /> : <Copy size={15} />}
                                    </button>
                                </div>
                                {copyMessage ? (
                                    <p className="mt-2 text-xs text-[#8fa66f]">{copyMessage}</p>
                                ) : null}
                            </div>
                        ) : null}
                    </aside>
                </section>

                {error ? (
                    <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {error}
                    </p>
                ) : null}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
    }

    const screenKey = screen === "dashboard" ? "dashboard" : `${screen}-${activeLobbyId ?? 0}`;

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={screenKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
            >
                {content}
            </motion.div>
        </AnimatePresence>
    );
}
