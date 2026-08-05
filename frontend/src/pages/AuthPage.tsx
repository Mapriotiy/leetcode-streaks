import { useEffect, useMemo, useState } from "react";
import { Flame, Map as MapIcon, Play, Users, Zap, Trophy, Grid2x2 } from "lucide-react";
import { useGoogleLogin } from "./auth/useGoogleLogin";
import { GoogleButton } from "./auth/GoogleButton";
import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";
import ProvinceMap from "../components/ProvinceMap";
import { REGIONS } from "../mapRegions";

type AuthPageProps = {
    initialError?: string | null;
    onClearError?: () => void;
};

const FACTION_COLORS = ["#00c2ff", "#ffb020", "#27d980"];
const ENEMY_COLOR = "#ff2d55";

function HeroMap() {
    const [captured, setCaptured] = useState<Map<string, string>>(new Map());
    const provinces = useMemo(() => REGIONS.flatMap((region) => region.provinces), []);

    useEffect(() => {
        let index = 0;
        const interval = window.setInterval(() => {
            const id = provinces[index % provinces.length];
            const isEnemy = Math.floor(index / 2) % 4 === 3;
            const color = isEnemy
                ? ENEMY_COLOR
                : FACTION_COLORS[Math.floor(index / 2) % FACTION_COLORS.length];
            setCaptured((prev) => {
                const next = new Map(prev);
                next.set(id, color);
                return next;
            });
            index += 1;
        }, 280);
        return () => window.clearInterval(interval);
    }, [provinces]);

    return (
        <div className="pointer-events-none select-none">
            <ProvinceMap captured={captured} onSelect={() => {}} highlightedProvinces={null} />
        </div>
    );
}

const STEPS = [
    {
        icon: MapIcon,
        title: "Solve a problem",
        body: "Click a province to open its LeetCode problem. Accepted submissions plant your flag.",
    },
    {
        icon: Trophy,
        title: "Capture the map",
        body: "Own provinces and beat runtimes to steal them. Lock whole regions for control bonuses.",
    },
    {
        icon: Flame,
        title: "Keep the streak",
        body: "Solve daily to grow your streak — and spread your color across the board.",
    },
];

const FEATURES = [
    { icon: Users, title: "Factions & friends", body: "Form teams, split the map, and race your friends to victory." },
    { icon: Zap, title: "Power-ups", body: "Reroll, Fortify and Siege turn the tide when you need an edge." },
    { icon: Grid2x2, title: "Bingo mode", body: "A fresh take: claim cells and complete lines to win." },
    { icon: Play, title: "Live & replayable", body: "See captures in real time and share any match as a replay." },
];

export function AuthPage({ initialError = null, onClearError }: AuthPageProps) {
    const { errorMessage, isRedirecting, onLogin } = useGoogleLogin(initialError, onClearError);

    return (
        <main className="min-h-screen bg-[#0b0c0e] text-white">
            {/* Nav */}
            <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0c0e]/85 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-[#ffa116]/40 bg-[#ffa116]/10">
                            <Logo size={22} />
                        </span>
                        <span className="text-lg font-bold tracking-tight text-[#eff1f6]">MapCode</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="#how" className="hidden text-sm text-[#9a9a9a] transition hover:text-white sm:block">
                            How it works
                        </a>
                        <a href="#features" className="hidden text-sm text-[#9a9a9a] transition hover:text-white sm:block">
                            Features
                        </a>
                        <GoogleButton onLogin={onLogin} isRedirecting={isRedirecting} className="!w-auto !px-4 !py-2" />
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -top-20 right-0 h-96 w-96 rounded-full opacity-20"
                    style={{ background: "radial-gradient(circle, #ffa116 0%, transparent 70%)" }}
                />
                <div className="relative">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#ffa116]/30 bg-[#ffa116]/10 px-3 py-1 text-xs font-semibold text-[#ffd08a]">
                        Free · play with friends
                    </span>
                    <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                        Solve LeetCode.
                        <br />
                        <span className="text-[#ffa116]">Capture the map.</span>
                    </h1>
                    <p className="mt-5 max-w-md text-base leading-relaxed text-[#9a9a9a]">
                        Turn your daily grind into a live territory battle. Plant flags, steal provinces,
                        and keep a streak that never lets you quit.
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <GoogleButton onLogin={onLogin} isRedirecting={isRedirecting} className="sm:!w-auto sm:!px-8 sm:!py-3.5" />
                        <a
                            href="#how"
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/5"
                        >
                            See how it works
                        </a>
                    </div>
                    {errorMessage ? (
                        <p className="mt-4 max-w-sm rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                            {errorMessage}
                        </p>
                    ) : null}
                    <p className="mt-6 text-xs text-[#6a6a6a]">
                        An independent project, not affiliated with LeetCode.
                    </p>
                </div>

                <div className="relative">
                    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
                        <HeroMap />
                    </div>
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-2xl"
                        style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.6)" }}
                    />
                </div>
            </section>

            {/* How it works */}
            <section id="how" className="mx-auto max-w-6xl px-6 py-16">
                <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#ffa116]">
                    How it works
                </p>
                <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
                    Three steps to own the map
                </h2>
                <div className="mt-10 grid gap-5 md:grid-cols-3">
                    {STEPS.map((step, index) => (
                        <div
                            key={step.title}
                            className="rounded-2xl border border-white/10 bg-[#141519] p-6 transition hover:border-[#ffa116]/40"
                        >
                            <div className="flex items-center gap-3">
                                <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#ffa116]/30 bg-[#ffa116]/10 text-[#ffa116]">
                                    <step.icon size={20} />
                                </span>
                                <span className="text-xs font-bold text-[#666]">0{index + 1}</span>
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-[#eff1f6]">{step.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-[#9a9a9a]">{step.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section id="features" className="mx-auto max-w-6xl px-6 py-16">
                <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#ffa116]">
                    Features
                </p>
                <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
                    Built for the grind
                </h2>
                <div className="mt-10 grid gap-5 sm:grid-cols-2">
                    {FEATURES.map((feature) => (
                        <div
                            key={feature.title}
                            className="flex gap-4 rounded-2xl border border-white/10 bg-[#141519] p-6 transition hover:border-[#00d9ff]/40"
                        >
                            <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#00d9ff]/30 bg-[#00d9ff]/10 text-[#7fe8ff]">
                                <feature.icon size={20} />
                            </span>
                            <div>
                                <h3 className="font-semibold text-[#eff1f6]">{feature.title}</h3>
                                <p className="mt-1 text-sm leading-relaxed text-[#9a9a9a]">{feature.body}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="relative mx-auto max-w-3xl px-6 py-20 text-center">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10"
                    style={{ background: "radial-gradient(50% 50% at 50% 100%, rgba(255,161,22,0.12), transparent 70%)" }}
                />
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Ready to claim your first province?
                </h2>
                <p className="mt-3 text-sm text-[#9a9a9a]">
                    Sign in with Google and link your LeetCode account to start.
                </p>
                <div className="mx-auto mt-8 max-w-sm">
                    <GoogleButton onLogin={onLogin} isRedirecting={isRedirecting} className="!py-3.5" />
                    {errorMessage ? (
                        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                            {errorMessage}
                        </p>
                    ) : null}
                </div>
            </section>

            <Footer />
        </main>
    );
}
