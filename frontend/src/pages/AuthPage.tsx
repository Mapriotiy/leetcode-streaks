import { useState } from "react";
import { apiRequest } from "../api/client";

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
        <main className="min-h-screen bg-transparent text-white">
            <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
                <section className="w-full max-w-md rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                    <div className="mb-6">
                        <p className="mb-2 text-sm font-medium text-[#ffa116]">
                            LeetCode Streaks
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Welcome back
                        </h1>
                        <p className="mt-2 text-sm text-[#b3b3b3]">
                            Track a shared coding streak with your friends.
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
        </main>
    );
}
