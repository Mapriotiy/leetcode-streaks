import {
    Activity,
    ChevronRight,
    Crown,
    Flame,
    Gamepad2,
    Home,
    Shield,
    Swords,
    Target,
    Trophy,
    UserPlus,
    Users,
} from "lucide-react";
import { Logo } from "../components/Logo";

const MAP_BG = `${import.meta.env.BASE_URL}maps/leet_background.webp`;

const navItems = [
    { label: "Home", icon: Home, active: true },
    { label: "Lobbies", icon: Gamepad2 },
    { label: "Activity", icon: Activity },
    { label: "Leaderboard", icon: Trophy },
    { label: "Challenges", icon: Target },
];

const games = [
    {
        name: "mapriotii's game",
        team: "Your empire",
        action: "Continue",
        players: "2 / 4 players",
        language: "Python 3",
        activity: "2h ago",
        captured: "3 / 12 captured",
        accent: "#d87a38",
        tone: "ember",
    },
    {
        name: "bangreedy's game",
        team: "Team Dragon",
        action: "Open map",
        players: "4 / 4 players",
        language: "Python 3",
        activity: "30m ago",
        captured: "5 / 12 captured",
        accent: "#6f93a1",
        tone: "ink",
    },
];

const friends = [
    { name: "jambikkk", subtitle: "Longest streak: 7 days", streak: 7, color: "#6f93a1" },
    { name: "bangreedy", subtitle: "Longest streak: 5 days", streak: 5, color: "#d87a38" },
    { name: "devkoya", subtitle: "Longest streak: 3 days", streak: 3, color: "#9d6b93" },
    { name: "syntax_sam", subtitle: "Longest streak: 2 days", streak: 2, color: "#8fa66f" },
];

const metrics = [
    { label: "Active days", value: "32", icon: Swords, color: "#f1c58e" },
    { label: "Territories captured", value: "8", icon: Crown, color: "#d87a38" },
    { label: "Global rank", value: "#24", icon: Trophy, color: "#e6a15d", trend: "+12" },
    { label: "Problems solved this week", value: "62", icon: Target, color: "#b86a3a" },
];

function NavItem({ item }: { item: (typeof navItems)[number] }) {
    const Icon = item.icon;

    return (
        <button
            type="button"
            className={`inline-flex h-12 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${
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
            className="relative h-full min-h-[8.5rem] overflow-hidden rounded-md border border-[#3f332d] bg-[#191410]"
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

function GameCard({ game }: { game: (typeof games)[number] }) {
    return (
        <article className="rounded-lg border border-[#3f332d] bg-[#211a16]/88 p-3 shadow-xl shadow-black/20">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-md border bg-[#2b211c]"
                        style={{ borderColor: `${game.accent}80`, color: game.accent }}
                    >
                        <Shield size={22} />
                    </span>
                    <div>
                        <h3 className="text-sm font-bold text-[#f4e7d8]">{game.name}</h3>
                        <p className="mt-1 text-xs text-[#a8917d]">● {game.team}</p>
                    </div>
                </div>
                <button
                    type="button"
                    className="h-9 rounded-md border border-[#4c3a31] px-3 text-xs font-bold text-[#e6a15d] transition hover:border-[#d87a38]"
                >
                    {game.action}
                </button>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_7.5rem] gap-3">
                <MapPreview />
                <div className="rounded-md border border-[#3f332d] bg-[#1b1512]/88 p-3 text-xs text-[#a8917d]">
                    <p className="font-semibold text-[#d9c5ad]">{game.players}</p>
                    <p className="mt-3">🐍 {game.language}</p>
                    <p className="mt-5">Last activity</p>
                    <p className="mt-1 font-semibold text-[#d9c5ad]">{game.activity}</p>
                </div>
            </div>

            <div className="mt-3 flex items-center gap-3 text-xs text-[#a8917d]">
                <span>Territories</span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-[#3b3029]">
                    <span
                        className="block h-full rounded-full"
                        style={{
                            width: game.tone === "ink" ? "42%" : "30%",
                            backgroundColor: game.accent,
                        }}
                    />
                </span>
                <strong className="text-[#e6a15d]">{game.captured}</strong>
            </div>
        </article>
    );
}

function FriendRow({ friend }: { friend: (typeof friends)[number] }) {
    return (
        <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-md border border-[#3f332d] bg-[#211a16]/88 px-3 py-2.5 text-left transition hover:border-[#7d4d32]"
        >
            <span className="flex min-w-0 items-center gap-3">
                <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border text-sm font-black text-[#17110e]"
                    style={{ backgroundColor: `${friend.color}dd`, borderColor: friend.color }}
                >
                    {friend.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                    <strong className="block truncate text-sm text-[#f4e7d8]">{friend.name}</strong>
                    <span className="mt-1 block truncate text-xs text-[#a8917d]">{friend.subtitle}</span>
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

function MetricItem({ metric }: { metric: (typeof metrics)[number] }) {
    const Icon = metric.icon;

    return (
        <div className="flex min-w-0 items-center gap-3 border-r border-[#3f332d] px-5 last:border-r-0">
            <Icon size={28} style={{ color: metric.color }} />
            <div>
                <div className="flex items-baseline gap-2">
                    <strong className="text-2xl text-[#f4e7d8]">{metric.value}</strong>
                    {metric.trend ? <span className="text-xs font-bold text-[#8fa66f]">{metric.trend}</span> : null}
                </div>
                <p className="mt-1 text-xs text-[#a8917d]">{metric.label}</p>
            </div>
        </div>
    );
}

export function MainPage() {
    return (
        <main className="min-h-screen bg-[#14110f] text-[#f4e7d8]">
            <header className="sticky top-0 z-30 border-b border-[#2b231f] bg-[#11100e]/94 backdrop-blur">
                <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-7">
                    <Logo className="text-[1.2rem]" />

                    <nav className="hidden items-center gap-2 lg:flex">
                        {navItems.map((item) => (
                            <NavItem key={item.label} item={item} />
                        ))}
                    </nav>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="flex h-12 items-center gap-3 rounded-lg border border-[#3f332d] bg-[#24201c] px-3 text-sm font-bold text-[#f4e7d8] shadow-lg shadow-black/20"
                        >
                            <span className="relative h-8 w-8 rounded-full bg-[linear-gradient(135deg,#7b5b46,#d1a77f)]">
                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-[#24201c] bg-[#79a85e]" />
                            </span>
                            mapriotii
                            <ChevronRight size={15} className="rotate-90 text-[#756354]" />
                        </button>
                        <button
                            type="button"
                            className="grid h-12 w-12 place-items-center rounded-lg border border-[#3f332d] bg-[#24201c] text-[#d9c5ad]"
                            aria-label="Security"
                        >
                            <Shield size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-7 py-4">
                <section className="grid min-h-[14.5rem] grid-cols-[13rem_minmax(0,1fr)_14rem] gap-5 overflow-hidden rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-4 shadow-2xl shadow-black/30">
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
                            <h1 className="text-4xl font-black leading-none text-[#f4e7d8] md:text-5xl">
                                Today's conquest
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-6 text-[#a8917d]">
                                Solve problems. Capture territories. Grow your empire.
                            </p>

                            <div className="mt-6 flex items-center gap-4">
                                <span className="grid h-14 w-14 place-items-center rounded-full border border-[#7d4d32] bg-[#33241b] text-[#e6a15d] shadow-lg shadow-[#8a3e22]/20">
                                    <Flame size={25} fill="currentColor" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <strong className="block text-sm">Daily challenge</strong>
                                            <span className="mt-1 block text-xs text-[#a8917d]">Solve today to claim your territory.</span>
                                        </div>
                                        <span className="text-sm text-[#a8917d]">2 / 4 solved</span>
                                    </div>
                                    <div className="mt-4 h-3 overflow-hidden rounded-full border border-[#3f332d] bg-[#191410]">
                                        <span className="block h-full w-1/2 rounded-full bg-[linear-gradient(90deg,#d87a38,#e6a15d)]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <MapPreview />
                    </div>

                    <aside className="rounded-lg border border-[#3f332d] bg-[#1c1613]/86 p-4">
                        <div className="flex items-center gap-3 border-b border-[#3f332d] pb-4">
                            <Flame size={33} className="text-[#e6a15d]" fill="currentColor" />
                            <div>
                                <strong className="block text-2xl">2</strong>
                                <span className="text-xs text-[#a8917d]">day streak</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 border-b border-[#3f332d] py-4">
                            <Crown size={32} className="text-[#f1c58e]" />
                            <div>
                                <strong className="block text-2xl">5</strong>
                                <span className="text-xs text-[#a8917d]">territories conquered this week</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="mt-4 h-11 w-full rounded-lg bg-[linear-gradient(180deg,#e6a15d,#c76f32)] text-sm font-black text-[#1d120c] shadow-lg shadow-[#8a3e22]/25"
                        >
                            Start solving
                        </button>
                    </aside>
                </section>

                <section className="mt-3 grid grid-cols-[minmax(0,1fr)_23.5rem] gap-3">
                    <div className="rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-4 shadow-xl shadow-black/25">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-start gap-3">
                                <Users size={22} className="mt-0.5 text-[#f1c58e]" />
                                <div>
                                    <h2 className="text-lg font-black">Active games</h2>
                                    <p className="mt-1 text-sm text-[#a8917d]">Your ongoing conquests</p>
                                </div>
                                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#34271f] px-2 text-xs font-bold text-[#f1c58e]">
                                    2
                                </span>
                            </div>
                            <button type="button" className="inline-flex items-center gap-2 text-sm text-[#a8917d] hover:text-[#e6a15d]">
                                View all lobbies
                                <ChevronRight size={15} />
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            {games.map((game) => (
                                <GameCard key={game.name} game={game} />
                            ))}
                        </div>

                        <div className="mt-3 grid h-[4.5rem] grid-cols-4 rounded-lg border border-[#3f332d] bg-[#1b1512]/88 py-3">
                            {metrics.map((metric) => (
                                <MetricItem key={metric.label} metric={metric} />
                            ))}
                        </div>
                    </div>

                    <aside className="rounded-lg border border-[#3f332d] bg-[#211a16]/92 p-4 shadow-xl shadow-black/25">
                        <div className="mb-4 flex items-start gap-3">
                            <Flame size={22} className="mt-0.5 text-[#e6a15d]" fill="currentColor" />
                            <div>
                                <h2 className="text-lg font-black">Friend streaks</h2>
                                <p className="mt-1 text-sm text-[#a8917d]">Your allies, your rivals</p>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            {friends.map((friend) => (
                                <FriendRow key={friend.name} friend={friend} />
                            ))}
                        </div>

                        <button
                            type="button"
                            className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#3f332d] bg-[#1b1512] text-sm font-black text-[#e6a15d] transition hover:border-[#7d4d32]"
                        >
                            <UserPlus size={18} />
                            Invite a friend
                        </button>
                    </aside>
                </section>
            </div>
        </main>
    );
}
