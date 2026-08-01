import { useEffect, useState } from "react";
import { apiRequest } from "./api/client";
import { clearCache } from "./api/localCache";
import { InviteModal } from "./components/InviteModal";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LobbyPage } from "./pages/LobbyPage";
import { LobbyGamePage } from "./pages/LobbyGamePage";
import { MapTestPage } from "./pages/MapTestPage";
import type { Faction, LobbyPlayer } from "./types/dashboard";

type User = {
    id: number;
    google_sub: string | null;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
    leetcode_username: string | null;
    leetcode_verified_at: string | null;
};

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

// Guards against the OAuth callback being processed twice (StrictMode remounts).
const processedOAuthStates = new Set<string>();

export default function App() {
    const isMapTest = new URLSearchParams(window.location.search).get("mapTest") === "1";
    return isMapTest ? <MapTestPage /> : <MainApp />;
}

function MainApp() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoadingSession, setIsLoadingSession] = useState(true);
    const [sessionStalled, setSessionStalled] = useState(false);
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [lobbyInviteToken, setLobbyInviteToken] = useState<string | null>(null);
    const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
    const [activeLobbyId, setActiveLobbyId] = useState<number | null>(null);
    const [activeLobbyPlayers, setActiveLobbyPlayers] = useState<LobbyPlayer[]>([]);
    const [activeLobbyFactions, setActiveLobbyFactions] = useState<Faction[]>([]);
    const [authError, setAuthError] = useState<string | null>(null);

    function clearUrlParam(param: string) {
        const url = new URL(window.location.href);
        url.searchParams.delete(param);
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");

        async function bootstrap() {
            if (code && state && !processedOAuthStates.has(state)) {
                processedOAuthStates.add(state);
                try {
                    const res = await apiRequest<{ access_token: string }>("/auth/google/code", {
                        method: "POST",
                        body: JSON.stringify({ code, state }),
                    });
                    localStorage.setItem("accessToken", res.access_token);
                    clearUrlParam("code");
                    clearUrlParam("state");
                    setAuthError(null);
                    const me = await apiRequest<User>("/auth/me");
                    setUser(me);
                    const pendingInviteToken = localStorage.getItem("pendingInviteToken");
                    if (pendingInviteToken) setInviteToken(pendingInviteToken);
                    return;
                } catch (e) {
                    localStorage.removeItem("accessToken");
                    clearUrlParam("code");
                    clearUrlParam("state");
                    setAuthError(
                        e instanceof Error ? e.message : "Google sign-in failed. Please try again.",
                    );
                }
            }

            try {
                const me = await apiRequest<User>("/auth/me");
                setUser(me);
            } catch {
                localStorage.removeItem("accessToken");
                clearCache();
                setUser(null);
            }
        }

        void bootstrap().finally(() => setIsLoadingSession(false));
    }, []);

    // Only surface the loader if session bootstrap is genuinely slow; fast
    // loads should paint straight into the dashboard without a flash.
    useEffect(() => {
        const stallTimer = window.setTimeout(() => setSessionStalled(true), 200);
        return () => window.clearTimeout(stallTimer);
    }, []);

    useEffect(() => {
        function pingBackend() {
            apiRequest<{ status: string }>("/health").catch(() => {});
        }
        pingBackend();
        const intervalId = window.setInterval(pingBackend, KEEP_ALIVE_INTERVAL_MS);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get("invite");
        const lobbyToken = params.get("lobby");
        const pendingInviteToken = localStorage.getItem("pendingInviteToken");

        if (lobbyToken) {
            setLobbyInviteToken(lobbyToken);
            return;
        }

        if (tokenFromUrl) {
            setInviteToken(tokenFromUrl);
            localStorage.setItem("pendingInviteToken", tokenFromUrl);
            return;
        }

        if (pendingInviteToken) {
            setInviteToken(pendingInviteToken);
        }
    }, []);

    const handleAcceptedLobbyInvite = async (lobbyId: number) => {
        localStorage.removeItem("pendingLobbyInviteToken");
        setLobbyInviteToken(null);
        clearUrlParam("lobby");
        setActiveLobbyId(lobbyId);
        try {
            const data = await apiRequest<{ lobby: { id: number }; invite_url: string }>(`/lobbies/${lobbyId}`);
            setActiveLobbyId(data.lobby?.id ?? lobbyId);
        } catch {}
    };

    if (isLoadingSession) {
        return sessionStalled ? (
            <main className="min-h-screen bg-[#1a1a1a] p-6 text-white">
                Loading...
            </main>
        ) : null;
    }

    if (!user) {
        return (
            <AuthPage
                initialError={authError}
                onClearError={() => setAuthError(null)}
            />
        );
    }

    if (activeLobbyId && activeLobbyPlayers.length > 0) {
        return (
            <LobbyGamePage
                lobbyId={activeLobbyId}
                currentUserId={user.id}
                players={activeLobbyPlayers}
                factions={activeLobbyFactions}
                onBack={() => {
                    setActiveLobbyId(null);
                    setActiveLobbyPlayers([]);
                    setActiveLobbyFactions([]);
                    setDashboardRefreshKey((key) => key + 1);
                }}
                onLeft={() => {
                    setActiveLobbyId(null);
                    setActiveLobbyPlayers([]);
                    setActiveLobbyFactions([]);
                    setDashboardRefreshKey((key) => key + 1);
                }}
            />
        );
    }

    if (activeLobbyId) {
        return (
            <LobbyPage
                lobbyId={activeLobbyId}
                currentUserId={user.id}
                currentUserVerified={user.leetcode_verified_at != null}
                onBack={() => {
                    setActiveLobbyId(null);
                    setActiveLobbyFactions([]);
                    setDashboardRefreshKey((key) => key + 1);
                }}
                onGameStarted={(lobbyId, players, factions) => {
                    setActiveLobbyId(lobbyId);
                    setActiveLobbyPlayers(players);
                    setActiveLobbyFactions(factions);
                }}
            />
        );
    }

    return (
        <>
            <DashboardPage
                user={user}
                refreshKey={dashboardRefreshKey}
                onLogout={() => {
                    localStorage.removeItem("accessToken");
                    clearCache();
                    setUser(null);
                }}
                onOpenLobby={(lobbyId, players, factions) => {
                    setActiveLobbyId(lobbyId);
                    setActiveLobbyPlayers(players ?? []);
                    setActiveLobbyFactions(factions ?? []);
                }}
                onLinkChanged={() => {
                    apiRequest<User>("/auth/me").then(setUser).catch(() => {});
                }}
            />

            {inviteToken ? (
                <InviteModal
                    token={inviteToken}
                    user={user}
                    onClose={() => {
                        localStorage.removeItem("pendingInviteToken");
                        setInviteToken(null);
                        clearUrlParam("invite");
                    }}
                    onAccepted={() => {
                        localStorage.removeItem("pendingInviteToken");
                        setInviteToken(null);
                        clearUrlParam("invite");
                        setDashboardRefreshKey((key) => key + 1);
                    }}
                    onNeedAuth={() => {
                        setInviteToken(null);
                        clearUrlParam("invite");
                    }}
                />
            ) : null}

            {lobbyInviteToken ? (
                <LobbyInviteModal
                    token={lobbyInviteToken}
                    onBack={() => {
                        setLobbyInviteToken(null);
                        clearUrlParam("lobby");
                    }}
                    onAccepted={handleAcceptedLobbyInvite}
                />
            ) : null}
        </>
    );
}

function LobbyInviteModal({ token, onBack, onAccepted }: {
    token: string;
    onBack: () => void;
    onAccepted: (lobbyId: number) => void;
}) {
    const [info, setInfo] = useState<{
        lobby_id: number;
        lobby_name: string;
        creator_username: string;
        player_count: number;
        max_players: number;
        faction_mode: boolean;
        faction_count: number;
        programming_language: string;
        status: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiRequest<typeof info>(`/lobbies/invites/${token}`)
            .then(setInfo)
            .catch(() => setError("Invite not found"))
            .finally(() => setLoading(false));
    }, [token]);

    const handleAccept = async () => {
        setAccepting(true);
        try {
            const res = await apiRequest<{ id: number }>(`/lobbies/invites/${token}/accept`, { method: "POST" });
            onAccepted(res.id);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to accept");
        } finally {
            setAccepting(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="w-full max-w-sm rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 text-center text-sm text-[#8a8a8a] shadow-2xl">
                    Loading invite...
                </div>
            </div>
        );
    }

    if (error || !info) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="w-full max-w-sm rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 text-center shadow-2xl">
                    <p className="text-sm text-red-400">{error ?? "Invite not found"}</p>
                    <button type="button" onClick={onBack} className="mt-4 rounded-md border border-[#3a3a3a] bg-[#333] px-4 py-2 text-sm text-[#d7d7d7]">Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-sm rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-2xl">
                <h2 className="text-lg font-semibold text-white">Lobby Invite</h2>
                <p className="mt-2 text-sm text-[#b3b3b3]">
                    <span className="text-[#ffa116]">{info.creator_username}</span> invited you to <strong className="text-white">{info.lobby_name}</strong>
                </p>
                <p className="mt-1 text-xs text-[#8a8a8a]">
                    {info.faction_mode
                        ? `${info.player_count} players, ${info.faction_count} factions`
                        : `${info.player_count}/${info.max_players} players`}
                    {", "}
                    {info.programming_language}
                    {" - "}
                    {info.status === "active" ? "Game in progress" : "Waiting"}
                </p>
                {accepting ? (
                    <p className="mt-4 text-sm text-[#8a8a8a]">Accepting...</p>
                ) : error ? (
                    <p className="mt-2 text-sm text-red-400">{error}</p>
                ) : (
                    <div className="mt-4 flex gap-2">
                        <button type="button" onClick={onBack} className="flex-1 rounded-md border border-[#3a3a3a] bg-[#333] px-4 py-2 text-sm text-[#d7d7d7]">Back</button>
                        <button type="button" onClick={handleAccept} className="flex-1 rounded-md bg-[#ffa116] px-4 py-2 text-sm font-semibold text-[#111]">Accept</button>
                    </div>
                )}
            </div>
        </div>
    );
}
