import { Flame } from "lucide-react";
import { Footer } from "../../components/Footer";
import { GoogleButton } from "./GoogleButton";
import type { AuthFormProps } from "./useGoogleLogin";

const MAP_BG = `${import.meta.env.BASE_URL}map-bg.webp`;

export function AuthV2({ errorMessage, isRedirecting, onLogin }: AuthFormProps) {
    return (
        <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0d0e0f] text-white">
            <div
                aria-hidden
                className="absolute inset-0"
                style={{
                    backgroundImage: `url(${MAP_BG})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "blur(12px) brightness(0.42) saturate(0.85)",
                    animation: "slow-zoom 34s ease-in-out infinite alternate",
                }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "radial-gradient(80% 60% at 50% 45%, transparent 30%, rgba(10,11,13,0.7) 100%)",
                }}
            />

            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
                <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141519]/75 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
                    <div className="mb-6 flex flex-col items-center">
                        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#ffa116]/40 bg-[#ffa116]/10 text-[#ffa116] shadow-xl shadow-black/30">
                            <Flame size={24} strokeWidth={2.2} />
                        </span>
                        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                            MapCode
                        </h1>
                        <p className="mt-1 text-center text-sm text-[#a3a3a3]">
                            Solve. Capture the map. Keep the streak.
                        </p>
                    </div>

                    <GoogleButton onLogin={onLogin} isRedirecting={isRedirecting} />

                    {errorMessage ? (
                        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
                            {errorMessage}
                        </p>
                    ) : null}

                    <p className="mt-6 text-center text-xs text-[#8a8a8a]">
                        Sign in with Google to start your territory. You'll link your
                        LeetCode account right after.
                    </p>
                </section>
            </div>

            <div className="relative z-10">
                <Footer />
            </div>
        </main>
    );
}
