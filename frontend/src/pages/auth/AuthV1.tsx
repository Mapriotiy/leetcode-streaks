import { Flame } from "lucide-react";
import { Footer } from "../../components/Footer";
import { GoogleButton } from "./GoogleButton";
import type { AuthFormProps } from "./useGoogleLogin";

export function AuthV1({ errorMessage, isRedirecting, onLogin }: AuthFormProps) {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0b0c0e] px-6 text-white">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "radial-gradient(55% 40% at 50% 0%, rgba(255,161,22,0.08), transparent 70%)",
                }}
            />

            <div className="relative w-full max-w-sm">
                <div className="mb-8 flex flex-col items-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-[#15161a] text-[#ffa116] shadow-xl shadow-black/40">
                        <Flame size={24} strokeWidth={2.2} />
                    </span>
                    <h1 className="mt-6 text-2xl font-semibold tracking-tight">
                        Welcome back
                    </h1>
                    <p className="mt-2 text-center text-sm text-[#8a8a8a]">
                        Sign in to capture the map and keep your streak alive.
                    </p>
                </div>

                <GoogleButton onLogin={onLogin} isRedirecting={isRedirecting} />

                {errorMessage ? (
                    <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
                        {errorMessage}
                    </p>
                ) : null}

                <p className="mt-6 text-center text-xs text-[#666]">
                    By continuing you agree to keep your streak burning.
                    You'll link your LeetCode account after signing in.
                </p>
            </div>

            <div className="absolute inset-x-0 bottom-0">
                <Footer />
            </div>
        </main>
    );
}
