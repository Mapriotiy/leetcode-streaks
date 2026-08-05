import { useState } from "react";
import { Flame } from "lucide-react";
import { apiRequest } from "../api/client";
import { Footer } from "../components/Footer";

const MAP_BG = `${import.meta.env.BASE_URL}map-bg.webp`;

const TORN_EDGE_PATH = [
    "M0.40 0",
    "L0.355 0.035", "L0.415 0.07", "L0.365 0.105", "L0.425 0.14",
    "L0.37 0.175", "L0.43 0.21", "L0.36 0.245", "L0.425 0.28",
    "L0.37 0.315", "L0.435 0.35", "L0.375 0.385", "L0.44 0.42",
    "L0.38 0.455", "L0.445 0.49", "L0.385 0.525", "L0.45 0.56",
    "L0.39 0.595", "L0.455 0.63", "L0.395 0.665", "L0.46 0.70",
    "L0.40 0.735", "L0.465 0.77", "L0.405 0.805", "L0.47 0.84",
    "L0.41 0.875", "L0.475 0.91", "L0.415 0.945", "L0.485 0.98",
    "L0.505 1", "L1 1", "L1 0", "Z",
].join(" ");

type GoogleLoginUrlResponse = {
    auth_url: string;
    state: string;
};

type AuthPageProps = {
    initialError?: string | null;
    onClearError?: () => void;
};

export function AuthPage({ initialError = null, onClearError }: AuthPageProps) {
    const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
    const [isRedirecting, setIsRedirecting] = useState(false);

    async function handleGoogleLogin() {
        setErrorMessage(null);
        onClearError?.();
        setIsRedirecting(true);

        try {
            const res = await apiRequest<GoogleLoginUrlResponse>("/auth/google/login-url");
            window.location.href = res.auth_url;
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Something went wrong",
            );
            setIsRedirecting(false);
        }
    }

    return (
        <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#151618] text-white">
            <svg width="0" height="0" className="absolute" aria-hidden="true">
                <defs>
                    <clipPath id="authTornEdge" clipPathUnits="objectBoundingBox">
                        <path d={TORN_EDGE_PATH} />
                    </clipPath>
                </defs>
            </svg>

            {/* Blurred map: full-bleed on mobile, torn-right on md+ */}
            <div
                aria-hidden
                className="absolute inset-0 md:[clip-path:url(#authTornEdge)]"
                style={{
                    filter:
                        "blur(7px) brightness(0.45) saturate(0.85) drop-shadow(-8px 0 18px rgba(0,0,0,0.55))",
                }}
            >
                <img
                    src={MAP_BG}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                />
            </div>

            {/* Ambient glow on the content side */}
            <div
                aria-hidden
                className="pointer-events-none absolute -left-20 top-1/4 h-80 w-80 rounded-full opacity-25"
                style={{ background: "radial-gradient(circle, #ffa116 0%, transparent 70%)" }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute bottom-0 left-0 h-64 w-96 opacity-15"
                style={{ background: "radial-gradient(circle, #00d9ff 0%, transparent 70%)" }}
            />

            {/* Content */}
            <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-6 py-12 md:w-[48%] md:items-start md:px-12">
                <div className="mb-8 flex items-center gap-2.5">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#ffa116]/40 bg-[#ffa116]/10 text-[#ffa116]">
                        <Flame size={20} strokeWidth={2.2} />
                    </span>
                    <span className="text-xl font-bold tracking-tight text-[#eff1f6]">
                        MapCode
                    </span>
                </div>

                <section className="w-full max-w-md rounded-2xl border border-[#3a3a3a] bg-[#1e1e20]/85 p-7 shadow-2xl shadow-black/40 backdrop-blur-md">
                    <div className="mb-6">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Welcome back
                        </h1>
                        <p className="mt-2 text-sm text-[#b3b3b3]">
                            Solve LeetCode problems, capture the map, keep the streak
                            alive with your friends.
                        </p>
                    </div>

                    <div className="grid gap-4">
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={isRedirecting}
                            className="flex w-full items-center justify-center gap-3 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-4 py-2.5 text-sm font-semibold text-[#eff1f6] transition hover:border-[#ffa116]/60 hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                            </svg>
                            {isRedirecting ? "Redirecting to Google..." : "Continue with Google"}
                        </button>

                        {errorMessage ? (
                            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                {errorMessage}
                            </p>
                        ) : null}

                        <p className="text-center text-xs text-[#8a8a8a]">
                            After signing in, you'll be asked to link your LeetCode account
                            to start tracking solves.
                        </p>
                    </div>
                </section>
            </div>

            {/* Footer with a readable band over the map */}
            <div className="relative z-10 bg-gradient-to-t from-[#151618] via-[#151618]/55 to-transparent">
                <Footer />
            </div>
        </main>
    );
}
