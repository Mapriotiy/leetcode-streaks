import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, Check, ExternalLink, Link2, RefreshCw, Unlink, X } from "lucide-react";
import { apiRequest } from "../api/client";
import { useToast } from "./toast/ToastProvider";

const nowStore = { value: Date.now() };

function getNow(): number {
    return nowStore.value;
}

function subscribeNow(onChange: () => void): () => void {
    const id = window.setInterval(() => {
        nowStore.value = Date.now();
        onChange();
    }, 1000);
    return () => window.clearInterval(id);
}

function useNow(): number {
    return useSyncExternalStore(subscribeNow, getNow);
}

type Verification = {
    id: number;
    leetcode_username: string;
    problem_slug: string;
    status: "pending" | "verified" | "expired" | "failed";
    attempts: number;
    max_attempts: number;
    created_at: string;
    expires_at: string;
    verified_at: string | null;
    verified_submission_id: number | null;
    verified_submission_at: string | null;
    failure_reason: string | null;
    cooldown_until: string | null;
};

type LinkStatus = {
    linked: boolean;
    leetcode_username: string | null;
    leetcode_verified_at: string | null;
    verification: Verification | null;
};

type LeetCodeLinkModalProps = {
    onClose: () => void;
    onChanged: () => void;
};

function problemUrl(slug: string): string {
    return `https://leetcode.com/problems/${slug}/`;
}

function secondsUntil(nowMs: number, iso: string | null): number {
    if (!iso) return 0;
    const target = new Date(iso).getTime();
    return Math.max(0, Math.floor((target - nowMs) / 1000));
}

function formatClock(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function LeetCodeLinkModal({ onClose, onChanged }: LeetCodeLinkModalProps) {
    const { push } = useToast();
    const [status, setStatus] = useState<LinkStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const now = useNow();
    const pollRef = useRef<number | null>(null);

    const refresh = useCallback(async () => {
        try {
            const data = await apiRequest<LinkStatus>("/leetcode/link/status");
            setStatus(data);
            if (data.verification && !username) {
                setUsername(data.verification.leetcode_username);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load link status");
        } finally {
            setLoading(false);
        }
    }, [username]);

    useEffect(() => {
        let cancelled = false;
        apiRequest<LinkStatus>("/leetcode/link/status")
            .then((data) => {
                if (cancelled) return;
                setStatus(data);
                setUsername((current) => current || (data.verification?.leetcode_username ?? ""));
            })
            .catch((e) => {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : "Failed to load link status");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const verification = status?.verification;
        const isPending = verification?.status === "pending";
        const nowMs = Date.now();
        const cooldownLeft = secondsUntil(nowMs, verification?.cooldown_until ?? null);
        const expiresIn = verification ? secondsUntil(nowMs, verification.expires_at) : 0;

        if (isPending && (cooldownLeft > 0 || expiresIn > 0)) {
            if (pollRef.current == null) {
                pollRef.current = window.setInterval(() => {
                    void refresh();
                }, 5000);
            }
        } else if (pollRef.current != null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
        }
        return () => {
            if (pollRef.current != null) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [status, refresh]);

    const handleStart = async () => {
        const value = username.trim();
        if (!value) {
            setError("Enter your LeetCode username");
            return;
        }
        setBusy(true);
        setError(null);
        setSuccess(false);
        try {
            const verification = await apiRequest<Verification>("/leetcode/link/start", {
                method: "POST",
                body: JSON.stringify({ leetcode_username: value }),
            });
            setStatus((current) =>
                current ? { ...current, verification } : current,
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to start verification");
        } finally {
            setBusy(false);
        }
    };

    const handleVerify = async () => {
        setBusy(true);
        setError(null);
        setSuccess(false);
        try {
            const verification = await apiRequest<Verification>("/leetcode/link/verify", {
                method: "POST",
            });
            setStatus((current) =>
                current ? { ...current, linked: true, verification } : current,
            );
            if (verification.status === "verified") {
                setSuccess(true);
                push("success", "LeetCode account linked");
                onChanged();
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Verification failed");
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    const handleUnlink = async () => {
        setBusy(true);
        setError(null);
        try {
            await apiRequest("/leetcode/link", { method: "DELETE" });
            await refresh();
            push("info", "LeetCode account unlinked");
            onChanged();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to unlink");
        } finally {
            setBusy(false);
        }
    };

    if (loading && !status) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="w-full max-w-md rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 text-center text-sm text-[#8a8a8a] shadow-2xl">
                    Loading...
                </div>
            </div>
        );
    }

    const verification = status?.verification ?? null;
    const linked = status?.linked ?? false;

    const cooldownLeft = secondsUntil(now, verification?.cooldown_until ?? null);
    const expiresLeft = verification ? secondsUntil(now, verification.expires_at) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div
                className="w-full max-w-md rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <Link2 size={18} className="text-[#ffa116]" />
                        <h2 className="text-lg font-semibold text-white">
                            {linked ? "LeetCode account" : "Link LeetCode account"}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-8 w-8 place-items-center rounded-md text-[#8a8a8a] transition hover:bg-[#333] hover:text-white"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {linked && verification?.status === "verified" && status?.leetcode_username ? (
                    <div className="grid gap-4">
                        <div className="rounded-md border border-[#27d980]/30 bg-[#27d980]/10 px-3 py-2 text-sm text-[#7fe6a4]">
                            Linked to{" "}
                            <strong className="text-white">{status.leetcode_username}</strong>
                        </div>
                        <button
                            type="button"
                            onClick={handleUnlink}
                            disabled={busy}
                            className="flex w-full items-center justify-center gap-2 rounded-md border border-[#4a4a4a] bg-[#333] px-4 py-2 text-sm font-medium text-[#d7d7d7] transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Unlink size={15} />
                            {busy ? "Unlinking..." : "Unlink account"}
                        </button>
                        {error ? (
                            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                {error}
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <div className="grid gap-4">
                        <label className="grid gap-2 text-sm font-medium text-[#d7d7d7]">
                            LeetCode username
                            <input
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                disabled={verification?.status === "pending"}
                                type="text"
                                autoComplete="off"
                                placeholder="your-leetcode-username"
                                className="rounded-md border border-[#3a3a3a] bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#777777] focus:border-[#ffa116] focus:ring-2 focus:ring-[#ffa116]/20 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                        </label>

                        {!verification || verification.status === "expired" || verification.status === "failed" ? (
                            <>
                                {verification ? (
                                    <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                        {verification.status === "expired"
                                            ? "Previous verification window expired."
                                            : "Previous verification failed."}{" "}
                                        Start a new one.
                                    </p>
                                ) : (
                                    <p className="text-sm text-[#b3b3b3]">
                                        Submit an <strong className="text-white">Accepted</strong> solution for{" "}
                                        <a
                                            href={problemUrl("two-sum")}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-[#ffa116] hover:text-[#ffb84d]"
                                        >
                                            Two Sum <ExternalLink size={12} />
                                        </a>{" "}
                                        to prove you own this account.
                                    </p>
                                )}

                                <button
                                    type="button"
                                    onClick={handleStart}
                                    disabled={busy}
                                    className="w-full rounded-md bg-[#ffa116] px-4 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d] disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-[#777]"
                                >
                                    {busy ? "Starting..." : "Start verification"}
                                </button>
                            </>
                        ) : null}

                        {verification?.status === "pending" ? (
                            <>
                                <div className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] p-3 text-sm text-[#b3b3b3]">
                                    <p>
                                        Solve{" "}
                                        <a
                                            href={problemUrl(verification.problem_slug)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 font-medium text-[#ffa116] hover:text-[#ffb84d]"
                                        >
                                            Two Sum <ExternalLink size={12} />
                                        </a>{" "}
                                        on <strong className="text-white">{verification.leetcode_username}</strong> and
                                        get an <strong className="text-white">Accepted</strong> verdict, then verify.
                                    </p>
                                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#8a8a8a]">
                                        <li>Submission must be made after verification started.</li>
                                        <li>Verification window: {formatClock(expiresLeft)} remaining.</li>
                                    </ul>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleVerify}
                                    disabled={busy || cooldownLeft > 0}
                                    className="w-full rounded-md bg-[#ffa116] px-4 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d] disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-[#777]"
                                >
                                    <RefreshCw size={15} className="inline-block mr-2" />
                                    {cooldownLeft > 0
                                        ? `Wait ${cooldownLeft}s`
                                        : busy
                                          ? "Checking..."
                                          : `Verify (attempt ${verification.attempts}/${verification.max_attempts})`}
                                </button>
                            </>
                        ) : null}

                        {success ? (
                            <p className="rounded-md border border-[#27d980]/30 bg-[#27d980]/10 px-3 py-2 text-sm text-[#7fe6a4]">
                                <Check size={15} className="inline-block mr-1" />
                                LeetCode account verified!
                            </p>
                        ) : null}

                        {error ? (
                            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                <AlertCircle size={15} className="mr-1 inline-block" />
                                {error}
                            </p>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}
