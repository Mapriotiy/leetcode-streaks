import { FormEvent, useState } from "react";

type AuthMode = "login" | "register";

export function AuthPage() {
    const [mode, setMode] = useState<AuthMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const payload = {
            email,
            password,
        };

        console.log(mode, payload);
    }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-950">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
        <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
        <p className="mb-2 text-sm font-medium text-orange-600">
            LeetCode Streaks
    </p>
    <h1 className="text-2xl font-semibold tracking-tight">
    {mode === "login" ? "Welcome back" : "Create your account"}
    </h1>
    <p className="mt-2 text-sm text-slate-600">
        Track a shared coding streak with your friends.
    </p>
    </div>

    <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
    <button
        type="button"
    onClick={() => setMode("login")}
    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
        mode === "login"
            ? "bg-white text-slate-950 shadow-sm"
            : "text-slate-600 hover:text-slate-950"
    }`}
>
    Login
    </button>

    <button
    type="button"
    onClick={() => setMode("register")}
    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
        mode === "register"
            ? "bg-white text-slate-950 shadow-sm"
            : "text-slate-600 hover:text-slate-950"
    }`}
>
    Register
    </button>
    </div>

    <form onSubmit={handleSubmit} className="grid gap-4">
    <label className="grid gap-2 text-sm font-medium">
        Email
        <input
    value={email}
    onChange={(event) => setEmail(event.target.value)}
    type="email"
    required
    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        />
        </label>

        <label className="grid gap-2 text-sm font-medium">
        Password
        <input
    value={password}
    onChange={(event) => setPassword(event.target.value)}
    type="password"
    required
    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        />
        </label>

        <button
    type="submit"
    className="mt-2 rounded-md bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700"
    >
    {mode === "login" ? "Login" : "Create account"}
    </button>
    </form>
    </section>
    </div>
    </main>
);
}