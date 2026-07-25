import { useState } from "react";
import type { FormEvent } from "react";
import { apiRequest } from "../api/client";

type AuthMode = "login" | "register";

type TokenResponse = {
    access_token: string;
    token_type: string;
};

type User = {
    id: number;
    leetcode_username: string;
};

type AuthPageProps = {
    onAuthenticated: (user: User) => void;
};

export function AuthPage({ onAuthenticated }: AuthPageProps) {
    const [mode, setMode] = useState<AuthMode>("login");
    const [leetcodeUsername, setLeetcodeUsername] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage(null);
        setIsSubmitting(true);

        try {
            const endpoint = mode === "login" ? "/auth/login" : "/auth/register";

            const tokenResponse = await apiRequest<TokenResponse>(endpoint, {
                method: "POST",
                body: JSON.stringify({
                    leetcode_username: leetcodeUsername,
                    password,
                }),
            });

            localStorage.setItem("accessToken", tokenResponse.access_token);

            const user = await apiRequest<User>("/auth/me");
            onAuthenticated(user);
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Something went wrong",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#1a1a1a] text-white">
            <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
                <section className="w-full max-w-md rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                    <div className="mb-6">
                        <p className="mb-2 text-sm font-medium text-[#ffa116]">
                            LeetCode Streaks
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {mode === "login" ? "Welcome back" : "Create your account"}
                        </h1>
                        <p className="mt-2 text-sm text-[#b3b3b3]">
                            Track a shared coding streak with your friends.
                        </p>
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-[#1f1f1f] p-1">
                        <button
                            type="button"
                            onClick={() => setMode("login")}
                            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                                mode === "login"
                                    ? "bg-[#3a3a3a] text-white shadow-sm"
                                    : "text-[#b3b3b3] hover:text-white"
                            }`}
                        >
                            Login
                        </button>

                        <button
                            type="button"
                            onClick={() => setMode("register")}
                            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                                mode === "register"
                                    ? "bg-[#3a3a3a] text-white shadow-sm"
                                    : "text-[#b3b3b3] hover:text-white"
                            }`}
                        >
                            Register
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <label className="grid gap-2 text-sm font-medium">
                            LeetCode username
                            <input
                                value={leetcodeUsername}
                                onChange={(event) => setLeetcodeUsername(event.target.value)}
                                type="text"
                                autoComplete="username"
                                required
                                className="rounded-md border border-[#3a3a3a] bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#777777] focus:border-[#ffa116] focus:ring-2 focus:ring-[#ffa116]/20"
                            />
                        </label>

                        <label className="grid gap-2 text-sm font-medium">
                            Password
                            <input
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                type="password"
                                autoComplete={
                                    mode === "login" ? "current-password" : "new-password"
                                }
                                required
                                minLength={8}
                                className="rounded-md border border-[#3a3a3a] bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#777777] focus:border-[#ffa116] focus:ring-2 focus:ring-[#ffa116]/20"
                            />
                        </label>

                        {errorMessage ? (
                            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                {errorMessage}
                            </p>
                        ) : null}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="mt-2 rounded-md bg-[#ffa116] px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#ffb84d] disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-[#777777]"
                        >
                            {isSubmitting
                                ? "Please wait..."
                                : mode === "login"
                                    ? "Login"
                                    : "Create account"}
                        </button>
                    </form>
                </section>
            </div>
        </main>
    );
}
