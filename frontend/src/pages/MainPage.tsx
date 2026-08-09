import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    Activity,
    Check,
    ChevronDown,
    ChevronRight,
    Copy,
    Crown,
    Flame,
    Gamepad2,
    Home,
    Hourglass,
    LogOut,
    Shield,
    Swords,
    Target,
    Trash2,
    Trophy,
    UserCircle,
    UserPlus,
    Users,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { Footer } from "../components/Footer";
import { API_URL, apiRequest } from "../api/client";
import { LobbyPage } from "./LobbyPage";
import { LobbyGamePage } from "./LobbyGamePage";
import { ProfilePage } from "./ProfilePage";
import { AdminPage } from "./AdminPage";
import { LanguageIcon } from "../components/LanguageIcon";
import { CreateLobbyModal } from "../components/CreateLobbyModal";
import type { DashboardData, DashboardLobby, Faction, LobbyPlayer } from "../types/dashboard";

const MAP_BG = `${import.meta.env.BASE_URL}map-bg.webp`;

type User = {
    id: number;
    leetcode_username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    leetcode_verified_at: string | null;
    is_admin?: boolean;
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

function getFriendPreviewLimit() {
    if (typeof window === "undefined") return 5;
    if (window.innerWidth >= 3000) return 12;
    if (window.innerWidth >= 2200) return 10;
    if (window.innerWidth >= 1536) return 7;
    return 5;
}

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
            className="min-h-[100dvh] bg-[#14110f] pb-[env(safe-area-inset-bottom)] text-[#f4e7d8]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
        >
            <header className="sticky top-0 z-30 border-b border-[#2b231f] bg-[#11100e]/94 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-7 2xl:max-w-[1920px] min-[2200px]:max-w-[2240px] min-[3000px]:max-w-[2480px]">
                    <Logo className="text-[1.1rem]" />
                    <div className="hidden items-center gap-2 lg:flex">
                        <SkeletonBlock className="h-6 w-20" />
                        <SkeletonBlock className="h-6 w-24" />
                        <SkeletonBlock className="h-6 w-20" />
                    </div>
                    <div className="flex items-center gap-3">
                        <SkeletonBlock className="hidden h-10 w-32 sm:block" />
                        <SkeletonBlock className="hidden h-10 w-36 sm:block" />
                        <SkeletonBlock className="h-10 w-10" />
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-3 py-2 sm:px-7 2xl:max-w-[1920px] min-[2200px]:max-w-[2240px] min-[3000px]:max-w-[2480px]">
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
            <section className="grid min-h-[9.5rem] grid-cols-1 gap-3 overflow-hidden rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-3 shadow-2xl shadow-black/30 lg:grid-cols-[13rem_minmax(0,1fr)_14rem] lg:gap-5 2xl:grid-cols-[16rem_minmax(0,1fr)_17rem] min-[2200px]:grid-cols-[18rem_minmax(0,1fr)_19rem]">
                <SkeletonBlock className="hidden h-full min-h-[8rem] lg:block" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-5">
                    <div className="flex flex-col justify-center px-1">
                        <SkeletonBlock className="h-7 w-full max-w-56" />
                        <SkeletonBlock className="mt-3 h-4 w-full max-w-72" />
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

            <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_21rem] min-[2200px]:grid-cols-[minmax(0,1fr)_23rem]">
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

function NavItem({
    label,
    icon: Icon,
    active,
    onClick,
}: {
    label: string;
    icon: typeof Home;
    active: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition lg:h-10 ${
                active
                    ? "border-[#d87a38] text-[#e6a15d]"
                    : "border-transparent text-[#8f8278] hover:text-[#f1dfc8]"
            }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );
}

function MainHeader({
    user,
    activeNav,
    onHome,
    onOpenLobbies,
    onOpenProfile,
    onOpenAdmin,
    onLogout,
    profileMenuOpen,
    setProfileMenuOpen,
    profileMenuRef,
}: {
    user: User;
    activeNav: string;
    onHome: () => void;
    onOpenLobbies: () => void;
    onOpenProfile: () => void;
    onOpenAdmin: () => void;
    onLogout: () => void;
    profileMenuOpen: boolean;
    setProfileMenuOpen: (value: boolean) => void;
    profileMenuRef: RefObject<HTMLDivElement | null>;
}) {
    return (
        <header className="sticky top-0 z-30 border-b border-[#2b231f] bg-[#11100e]/94 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:gap-4 sm:px-7 2xl:max-w-[1920px] min-[2200px]:max-w-[2240px] min-[3000px]:max-w-[2480px]">
                <Logo className="text-[1.1rem]" />

                <nav className="hidden items-center gap-2 lg:flex">
                    {navItems.map((item) => (
                        <NavItem
                            key={item.label}
                            label={item.label}
                            icon={item.icon}
                            active={activeNav === item.label}
                            onClick={
                                item.label === "Home"
                                    ? onHome
                                    : item.label === "Lobbies"
                                      ? onOpenLobbies
                                      : undefined
                            }
                        />
                    ))}
                </nav>

                <div className="flex items-center gap-3">
                    <div className="relative" ref={profileMenuRef}>
                        <button
                            type="button"
                            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                            className="group flex h-11 items-center gap-2.5 rounded-lg border border-[#3f332d] bg-[#24201c] px-3 text-sm font-bold text-[#f4e7d8] shadow-lg shadow-black/20 transition hover:border-[#7d4d32] sm:h-10"
                        >
                            <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-[#4c3a31] bg-[#33241b] text-[#d9c5ad]">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <UserCircle size={18} />
                                )}
                            </span>
                            <span className="hidden max-w-[10rem] truncate sm:block">
                                {user.leetcode_username ?? user.display_name ?? "Player"}
                            </span>
                            <ChevronDown
                                size={15}
                                className={`shrink-0 text-[#756354] transition ${profileMenuOpen ? "rotate-180" : ""}`}
                            />
                        </button>

                        {profileMenuOpen ? (
                            <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-[#3f332d] bg-[#1e1812] py-1 shadow-2xl shadow-black/50">
                                <button
                                    type="button"
                                    onClick={onOpenProfile}
                                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-[#f4e7d8] transition hover:bg-[#2b211c]"
                                >
                                    <UserCircle size={15} />
                                    View profile
                                </button>
                                {user.is_admin ? (
                                    <button
                                        type="button"
                                        onClick={onOpenAdmin}
                                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-[#f4e7d8] transition hover:bg-[#2b211c]"
                                    >
                                        <Shield size={15} />
                                        Admin panel
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={onLogout}
                                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-300 transition hover:bg-[#2b211c]"
                                >
                                    <LogOut size={15} />
                                    Logout
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
            <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
                {navItems.map((item) => (
                    <NavItem
                        key={item.label}
                        label={item.label}
                        icon={item.icon}
                        active={activeNav === item.label}
                        onClick={
                            item.label === "Home"
                                ? onHome
                                : item.label === "Lobbies"
                                  ? onOpenLobbies
                                  : undefined
                        }
                    />
                ))}
            </nav>
        </header>
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
    const thumbnailUrl = `${API_URL}/lobbies/${lobby.id}/thumbnail.png?w=640&fmt=webp&q=82`;
    const thumbnailSrcSet = [
        `${API_URL}/lobbies/${lobby.id}/thumbnail.png?w=320&fmt=webp&q=82 320w`,
        `${API_URL}/lobbies/${lobby.id}/thumbnail.png?w=480&fmt=webp&q=82 480w`,
        `${API_URL}/lobbies/${lobby.id}/thumbnail.png?w=640&fmt=webp&q=82 640w`,
    ].join(", ");

    return (
        <article className="min-w-0 overflow-hidden rounded-lg border border-[#3f332d] bg-[#211a16]/88 p-3 shadow-xl shadow-black/20 2xl:p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
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
                    className="h-11 shrink-0 rounded-md border border-[#4c3a31] px-3 text-xs font-bold text-[#e6a15d] transition hover:border-[#d87a38] sm:h-9"
                >
                    {lobby.status === "active" ? "Open map" : "Continue"}
                </button>
            </div>

            <div
                className="mt-2 grid min-w-0 gap-3"
                style={{
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
                }}
            >
                {lobby.status === "waiting" ? (
                    <div className="relative flex aspect-[16/10] min-w-0 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-dashed border-[#3f332d] bg-[#1b1612] sm:aspect-[1321/900]">
                        <span className="grid h-10 w-10 place-items-center rounded-full border border-[#4c3a31] bg-[#211a16] text-[#e6a15d]">
                            <Hourglass size={18} />
                        </span>
                        <p className="text-xs font-bold text-[#d9c5ad]">Waiting for players</p>
                        <p className="text-[11px] text-[#756354]">{playerCount} seated</p>
                    </div>
                ) : (
                <div className="min-w-0 w-full overflow-hidden rounded-md border border-[#3f332d] bg-[#191410]">
                    <img
                        src={thumbnailUrl}
                        srcSet={thumbnailSrcSet}
                        sizes="(min-width: 1536px) 520px, (min-width: 768px) 36vw, 92vw"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="aspect-[16/10] w-full object-cover sm:aspect-[1321/900]"
                    />
                </div>
                )}
                <div className="min-w-0 rounded-md border border-[#3f332d] bg-[#1b1512]/88 p-2 text-xs text-[#a8917d]">
                    <p className="font-semibold text-[#d9c5ad]">{slotLabel}</p>
                    <p className="mt-2 flex items-center gap-1.5">
                        <LanguageIcon language={lobby.programming_language} size={14} />
                        <span className="truncate">{LANGUAGE_LABELS[lobby.programming_language] ?? lobby.programming_language}</span>
                    </p>
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

function FriendRow({
    friend,
    onView,
    onRemove,
}: {
    friend: FriendRowData;
    onView: (friend: FriendRowData) => void;
    onRemove: (friendshipId: number) => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const onClick = (event: MouseEvent) => {
            if (
                menuRef.current &&
                rowRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                !rowRef.current.contains(event.target as Node)
            ) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
    }, [menuOpen]);

    const toggleMenu = () => {
        if (!menuOpen && rowRef.current) {
            const rect = rowRef.current.getBoundingClientRect();
            setMenuPos({
                top: rect.bottom + 4,
                right: Math.max(8, window.innerWidth - rect.right),
            });
        }
        setMenuOpen((value) => !value);
    };

    return (
        <div className="relative" ref={rowRef}>
            <button
                type="button"
                onClick={toggleMenu}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-[#3f332d] bg-[#211a16]/88 px-3 py-2 text-left transition hover:border-[#7d4d32]"
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
                    <ChevronRight size={15} className={`text-[#756354] transition ${menuOpen ? "rotate-90" : ""}`} />
                </span>
            </button>

            {menuOpen && menuPos
                ? createPortal(
                      <div
                          ref={menuRef}
                          className="fixed z-[100] w-48 overflow-hidden rounded-lg border border-[#3f332d] bg-[#1e1812] py-1 shadow-2xl shadow-black/60"
                          style={{ top: menuPos.top, right: menuPos.right }}
                      >
                          <button
                              type="button"
                              onClick={() => {
                                  setMenuOpen(false);
                                  onView(friend);
                              }}
                              disabled={!friend.leetcodeUsername}
                              className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-sm text-[#f4e7d8] transition hover:bg-[#2b211c] disabled:cursor-not-allowed disabled:text-[#756354]"
                          >
                              <UserCircle size={15} />
                              View profile
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                  setMenuOpen(false);
                                  onRemove(friend.friendshipId);
                              }}
                              className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-sm text-red-300 transition hover:bg-[#2b211c]"
                          >
                              <Trash2 size={15} />
                              Remove friend
                          </button>
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
}

type FriendRowData = {
    name: string;
    streak: number;
    longestStreak: number;
    color: string;
    leetcodeUsername: string | null;
    friendshipId: number;
};

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
            <Icon size={18} style={{ color }} className="shrink-0" />
            <div className="min-w-0">
                <strong className="block text-base text-[#f4e7d8]">{value}</strong>
                <p className="mt-0.5 truncate text-xs text-[#a8917d]" title={label}>
                    {label}
                </p>
            </div>
        </div>
    );
}

type NavState = {
    screen: "lobby" | "game" | "profile" | "lobbies" | "friendProfile" | "admin";
    lobbyId: number;
    players?: LobbyPlayer[];
    factions?: Faction[];
};

export function MainPage() {
    const [user, setUser] = useState<User | null>(null);
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [screen, setScreen] = useState<"dashboard" | "lobby" | "game" | "profile" | "lobbies" | "friendProfile" | "admin">("dashboard");
    const [activeLobbyId, setActiveLobbyId] = useState<number | null>(null);
    const [activePlayers, setActivePlayers] = useState<LobbyPlayer[]>([]);
    const [activeFactions, setActiveFactions] = useState<Faction[]>([]);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [isCreatingInvite, setIsCreatingInvite] = useState(false);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);
    const navDepthRef = useRef(0);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState<FriendRowData | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [friendPreviewLimit, setFriendPreviewLimit] = useState(getFriendPreviewLimit);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
        };
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
    }, []);

    useEffect(() => {
        const onResize = () => setFriendPreviewLimit(getFriendPreviewLimit());
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        apiRequest<User>("/auth/me")
            .then(setUser)
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const loadDashboard = useCallback(async () => {
        if (!user) return;
        try {
            setDashboardData(await apiRequest<DashboardData>("/dashboard/"));
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load dashboard");
        }
    }, [user]);

    // Refresh whenever the dashboard or all-lobbies screen becomes visible
    // (mount, back navigation) so lobbies that were deleted/created while
    // away are reflected.
    useEffect(() => {
        if (screen === "dashboard" || screen === "lobbies") {
            void loadDashboard();
        }
    }, [screen, loadDashboard]);

    const applyNavState = useCallback((state: NavState | null) => {
        if (state && (state.screen === "profile" || state.screen === "friendProfile" || state.screen === "lobbies" || state.screen === "admin")) {
            setScreen(state.screen);
            setActiveLobbyId(null);
            setActivePlayers([]);
            setActiveFactions([]);
        } else if (state && (state.screen === "lobby" || state.screen === "game")) {
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
            // Namespaced so MainApp's own popstate handler ignores these.
            window.history.pushState({ __mp: state }, "");
            applyNavState(state);
        },
        [applyNavState],
    );

    useEffect(() => {
        const onPopState = (event: PopStateEvent) => {
            navDepthRef.current = Math.max(0, navDepthRef.current - 1);
            const raw = event.state as { __mp?: NavState } | null;
            const state = raw?.__mp ?? null;
            // Back/forward into a lobby or game must not show a stale or
            // deleted lobby: verify it still exists before restoring.
            if (state && (state.screen === "lobby" || state.screen === "game")) {
                apiRequest(`/lobbies/${state.lobbyId}`)
                    .then(() => applyNavState(state))
                    .catch(() => applyNavState(null));
                return;
            }
            applyNavState(state);
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

    const openLobbies = useCallback(() => {
        pushNav({ screen: "lobbies", lobbyId: 0 });
    }, [pushNav]);

    const openProfile = useCallback(() => {
        setProfileMenuOpen(false);
        pushNav({ screen: "profile", lobbyId: 0 });
    }, [pushNav]);

    const openAdmin = useCallback(() => {
        setProfileMenuOpen(false);
        pushNav({ screen: "admin", lobbyId: 0 });
    }, [pushNav]);

    const handleViewFriend = useCallback(
        (friend: FriendRowData) => {
            setSelectedFriend(friend);
            pushNav({ screen: "friendProfile", lobbyId: 0 });
        },
        [pushNav],
    );

    const handleRemoveFriend = useCallback(async (friendshipId: number) => {
        setError(null);
        try {
            await apiRequest<void>(`/friends/${friendshipId}`, { method: "DELETE" });
            setDashboardData((data) =>
                data
                    ? { ...data, friends: data.friends.filter((f) => f.friendship_id !== friendshipId) }
                    : data,
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to remove friend");
        }
    }, []);

    const handleLogout = useCallback(() => {
        localStorage.removeItem("accessToken");
        setUser(null);
        setDashboardData(null);
        setScreen("dashboard");
        setInviteUrl(null);
    }, []);

    const handleLobbyCreated = useCallback(
        (lobbyId: number) => {
            setShowCreateModal(false);
            pushNav({ screen: "lobby", lobbyId });
        },
        [pushNav],
    );

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
            <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[#14110f] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center text-[#f4e7d8]">
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

    const lobbies = dashboardData?.lobbies ?? [];
    const friends = dashboardData?.friends ?? [];

    let content: ReactNode;

    if (screen === "profile") {
        content = <ProfilePage onBack={goDashboard} onLogout={handleLogout} />;
    } else if (screen === "admin") {
        content = <AdminPage onBack={goDashboard} onLogout={handleLogout} />;
    } else if (screen === "friendProfile" && selectedFriend) {
        content = (
            <main className="page-enter min-h-[100dvh] bg-[#14110f] pb-[env(safe-area-inset-bottom)] text-[#f4e7d8]">
                <div className="mx-auto max-w-3xl px-3 py-4 sm:px-7 sm:py-6">
                    <button
                        type="button"
                        onClick={goDashboard}
                            className="mb-6 grid h-11 w-11 place-items-center rounded-lg border border-[#3f332d] bg-[#24201c] text-[#d9c5ad] transition hover:border-[#7d4d32] sm:h-9 sm:w-9"
                        aria-label="Back"
                    >
                        <ChevronRight size={16} className="rotate-180" />
                    </button>

                    <div className="flex flex-col items-center gap-4 text-center">
                        <span
                            className="grid h-20 w-20 place-items-center rounded-full border-2 text-3xl font-black text-[#17110e]"
                            style={{
                                backgroundColor: `${selectedFriend.color}dd`,
                                borderColor: selectedFriend.color,
                            }}
                        >
                            {selectedFriend.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                            <h1 className="text-2xl font-black">{selectedFriend.name}</h1>
                            <p className="mt-1 text-sm text-[#a8917d]">
                                {selectedFriend.leetcodeUsername ?? "No LeetCode profile linked"}
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-5">
                            <p className="text-xs uppercase tracking-widest text-[#756354]">Current streak</p>
                            <p className="mt-2 flex items-center gap-2 font-serif text-4xl font-black text-[#f1c58e]">
                                <Flame size={26} fill="currentColor" />
                                {selectedFriend.streak}
                            </p>
                        </div>
                        <div className="rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-5">
                            <p className="text-xs uppercase tracking-widest text-[#756354]">Longest streak</p>
                            <p className="mt-2 font-serif text-4xl font-black text-[#f4e7d8]">{selectedFriend.longestStreak}</p>
                        </div>
                    </div>

                    {selectedFriend.leetcodeUsername ? (
                        <button
                            type="button"
                            onClick={() =>
                                window.open(
                                    `https://leetcode.com/u/${encodeURIComponent(selectedFriend.leetcodeUsername as string)}/`,
                                    "_blank",
                                    "noopener",
                                )
                            }
                            className="mt-6 h-11 w-full rounded-lg border border-[#4c3a31] bg-[#2b211c] text-sm font-black text-[#e6a15d] transition hover:border-[#d87a38]"
                        >
                            Open LeetCode profile
                        </button>
                    ) : null}
                </div>
            </main>
        );
    } else if (screen === "lobbies") {
        content = (
            <main className="page-enter min-h-[100dvh] bg-[#14110f] pb-[env(safe-area-inset-bottom)] text-[#f4e7d8]">
                <div className="mx-auto max-w-7xl px-3 py-4 sm:px-7 2xl:max-w-[1920px] min-[2200px]:max-w-[2240px] min-[3000px]:max-w-[2480px]">
                    <div className="mb-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={goDashboard}
                            className="grid h-11 w-11 place-items-center rounded-lg border border-[#3f332d] bg-[#24201c] text-[#d9c5ad] transition hover:border-[#7d4d32] sm:h-9 sm:w-9"
                            aria-label="Back"
                        >
                            <ChevronRight size={16} className="rotate-180" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black">All lobbies</h1>
                            <p className="mt-0.5 text-sm text-[#a8917d]">{lobbies.length} total</p>
                        </div>
                    </div>

                    {lobbies.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3 min-[2200px]:grid-cols-4">
                            {lobbies.map((lobby, index) => (
                                <GameCard key={lobby.id} lobby={lobby} index={index} onOpen={openLobby} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border border-dashed border-[#3f332d] bg-[#1b1512]/88 p-8 text-center text-sm text-[#a8917d]">
                            No lobbies yet.
                        </div>
                    )}
                </div>
            </main>
        );
    } else if (screen === "game" && activeLobbyId != null) {
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
    const metrics = [
        { label: "Active days", value: String(dashboardData?.active_days_count ?? 0), icon: Swords, color: "#f1c58e" },
        { label: "Territories captured", value: String(dashboardData?.stats?.total_captures ?? 0), icon: Crown, color: "#d87a38" },
        { label: "Games played", value: String(dashboardData?.stats?.games_played ?? 0), icon: Gamepad2, color: "#e6a15d" },
        { label: "Win rate", value: `${Math.round(dashboardData?.stats?.win_rate ?? 0)}%`, icon: Target, color: "#b86a3a" },
    ];
    const isDashboardLoading = !dashboardData && !error;

    content = (
        <main className="min-h-[100dvh] bg-[#14110f] pb-[calc(1rem+env(safe-area-inset-bottom))] text-[#f4e7d8]">
            <div className="mx-auto max-w-7xl px-3 py-2 sm:px-7 2xl:max-w-[1920px] min-[2200px]:max-w-[2240px] min-[3000px]:max-w-[2480px]">
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
                <section
                    className="relative grid min-h-[12rem] grid-cols-1 gap-3 overflow-hidden rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-3 shadow-2xl shadow-black/30 sm:min-h-[13.5rem] sm:gap-5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_14rem] 2xl:grid-cols-[minmax(0,1fr)_17rem] min-[2200px]:grid-cols-[minmax(0,1fr)_19rem]"
                    style={{
                        backgroundImage: `url(${MAP_BG})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,rgba(216,122,56,0.18),transparent_28%),linear-gradient(90deg,rgba(20,17,15,0.95),rgba(20,17,15,0.8)_38%,rgba(20,17,15,0.42)_72%,rgba(20,17,15,0.66))]" />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(20,17,15,0.12),transparent_42%,rgba(20,17,15,0.6))]" />

                    <div className="relative z-10 flex min-w-0 flex-col justify-center px-1 py-1 sm:py-3">
                        <div className="flex flex-col justify-center px-1">
                            <h1 className="text-2xl font-black leading-none text-[#f4e7d8] md:text-3xl">
                                Today's conquest
                            </h1>
                            <p className="mt-2 max-w-xl text-sm leading-5 text-[#a8917d]">
                                Solve problems. Capture territories. Grow your empire.
                            </p>

                            <div className="mt-3 flex items-start gap-3 sm:items-center sm:gap-4">
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#7d4d32] bg-[#33241b] text-[#e6a15d] shadow-lg shadow-[#8a3e22]/20">
                                    <Flame size={21} fill="currentColor" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                        <div>
                                            <strong className="block text-sm">Daily challenge</strong>
                                            <span className="mt-0.5 block text-xs text-[#a8917d]">Solve today to claim your territory.</span>
                                        </div>
                                        <span className="text-xs text-[#a8917d] sm:text-sm">
                                            {dashboardData?.today_submissions.length ?? 0} solved today
                                        </span>
                                    </div>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full border border-[#3f332d] bg-[#191410]">
                                        <span className="block h-full w-full rounded-full bg-[linear-gradient(90deg,#d87a38,#e6a15d)]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <aside className="relative z-10 rounded-lg border border-[#3f332d] bg-[#1c1613]/86 p-2.5 backdrop-blur-sm">
                        <div className="flex items-center gap-3 border-b border-[#3f332d] pb-2">
                            <Flame size={26} className="text-[#e6a15d]" fill="currentColor" />
                            <div>
                                <strong className="block text-xl leading-none">{dashboardData?.current_streak ?? 0}</strong>
                                <span className="mt-1 block text-xs text-[#a8917d]">
                                    day streak - {dashboardData?.current_streak_state ?? "broken"}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 border-b border-[#3f332d] py-2">
                            <Crown size={25} className="text-[#f1c58e]" />
                            <div>
                                <strong className="block text-xl leading-none">{dashboardData?.longest_streak ?? 0}</strong>
                                <span className="mt-1 block text-xs text-[#a8917d]">longest streak ever</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="mt-3 h-11 w-full rounded-lg border border-[#4c3a31] bg-[#2b211c] text-sm font-black text-[#a8917d] sm:h-10"
                        >
                            Start solving
                        </button>
                    </aside>
                </section>

                <section className="mt-2 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_21rem] min-[2200px]:grid-cols-[minmax(0,1fr)_23rem]">
                    <div className="min-w-0 rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-3 shadow-xl shadow-black/25 2xl:p-4">
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                            <div className="flex items-center gap-3 sm:justify-end">
                                {lobbies.length > 2 ? (
                                    <button
                                        type="button"
                                        onClick={openLobbies}
                                        className="inline-flex h-11 items-center text-xs font-semibold text-[#8f8278] underline decoration-[#8f8278]/40 underline-offset-4 transition hover:text-[#e6a15d] hover:decoration-[#e6a15d] sm:h-auto"
                                    >
                                        Show all ({lobbies.length})
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(true)}
                                    className="h-11 flex-1 shrink-0 rounded-lg bg-[linear-gradient(180deg,#e6a15d,#c76f32)] px-4 text-sm font-black text-[#1d120c] shadow-lg shadow-[#8a3e22]/25 sm:h-9 sm:flex-none"
                                >
                                    New Battle
                                </button>
                            </div>
                        </div>

                        {lobbies.length > 0 ? (
                            <div
                                className="grid auto-rows-fr gap-3"
                                style={{
                                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 28rem), 1fr))",
                                }}
                            >
                                {lobbies.slice(0, 2).map((lobby, index) => (
                                    <GameCard key={lobby.id} lobby={lobby} index={index} onOpen={openLobby} />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-md border border-dashed border-[#3f332d] bg-[#1b1512]/88 p-6 text-center text-sm text-[#a8917d]">
                                No games yet. Start your first expedition.
                            </div>
                        )}

                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-2 rounded-lg border border-[#3f332d] bg-[#1b1512]/88 px-3 py-1.5 md:grid-cols-4">
                            {metrics.map((metric) => (
                                <MetricItem key={metric.label} icon={metric.icon} value={metric.value} label={metric.label} color={metric.color} />
                            ))}
                        </div>
                    </div>

                    <aside className="min-w-0 rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-3 shadow-xl shadow-black/25 2xl:p-4">
                        <div className="mb-3 flex items-start gap-3">
                            <Flame size={20} className="mt-0.5 text-[#e6a15d]" fill="currentColor" />
                            <div>
                                <h2 className="text-base font-black">Friend streaks</h2>
                                <p className="mt-1 text-sm text-[#a8917d]">Your allies, your rivals</p>
                            </div>
                        </div>

                        <div className="grid gap-1.5 xl:max-h-[10rem] xl:overflow-y-auto xl:pr-0.5">
                            {friends.length > 0 ? (
                                friends.slice(0, friendPreviewLimit).map((friend, index) => (
                                    <FriendRow
                                        key={friend.friendship_id}
                                        friend={{
                                            name: friend.friend.leetcode_username ?? `user #${friend.friend.id}`,
                                            streak: friend.streak.current_count ?? friend.streak.longest_count ?? 0,
                                            longestStreak: friend.streak.longest_count ?? 0,
                                            color: FRIEND_COLORS[index % FRIEND_COLORS.length],
                                            leetcodeUsername: friend.friend.leetcode_username,
                                            friendshipId: friend.friendship_id,
                                        }}
                                        onView={handleViewFriend}
                                        onRemove={(friendshipId) => void handleRemoveFriend(friendshipId)}
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
                            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#3f332d] bg-[#1b1512] text-sm font-black text-[#e6a15d] transition hover:border-[#7d4d32] disabled:cursor-not-allowed disabled:text-[#756354] sm:h-10"
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
                                        className="min-w-0 flex-1 rounded-md border border-[#3f332d] bg-[#191410] px-2 py-2 text-base text-[#d9c5ad] sm:py-1.5 sm:text-xs"
                                        onFocus={(e) => e.currentTarget.select()}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void copyInvite()}
                                        className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#4c3a31] text-[#e6a15d] transition hover:border-[#d87a38] sm:h-8 sm:w-8"
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
            <Footer />
        </main>
    );
    }

    const screenKey = screen === "dashboard" ? "dashboard" : `${screen}-${activeLobbyId ?? 0}`;
    const activeNav = screen === "dashboard" || screen === "profile" || screen === "friendProfile" || screen === "admin" ? "Home" : "Lobbies";

    return (
        <div className="min-h-[100dvh] bg-[#14110f] text-[#f4e7d8]">
            <MainHeader
                user={user}
                activeNav={activeNav}
                onHome={goDashboard}
                onOpenLobbies={openLobbies}
                onOpenProfile={openProfile}
                onOpenAdmin={openAdmin}
                onLogout={handleLogout}
                profileMenuOpen={profileMenuOpen}
                setProfileMenuOpen={setProfileMenuOpen}
                profileMenuRef={profileMenuRef}
            />
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

            {showCreateModal ? (
                <CreateLobbyModal
                    username={user.leetcode_username ?? ""}
                    friends={dashboardData?.friends ?? []}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={handleLobbyCreated}
                />
            ) : null}
        </div>
    );
}
