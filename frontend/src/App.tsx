import { useEffect, useState } from "react";
import { apiRequest } from "./api/client";
import { InviteModal } from "./components/InviteModal";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MapPage } from "./pages/MapPage";

type User = {
    id: number;
    leetcode_username: string;
};

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoadingSession, setIsLoadingSession] = useState(true);
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
    const [activeMapFriendship, setActiveMapFriendship] = useState<{
        friendshipId: number;
        friendId: number;
        friendUsername: string;
    } | null>(null);

    function clearInviteUrl() {
        const url = new URL(window.location.href);
        url.searchParams.delete("invite");
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }

    useEffect(() => {
        apiRequest<User>("/auth/me")
            .then(setUser)
            .catch(() => {
                localStorage.removeItem("accessToken");
                setUser(null);
            })
            .finally(() => setIsLoadingSession(false));
    }, []);

    useEffect(() => {
        function pingBackend() {
            apiRequest<{ status: string }>("/health").catch(() => {
                // Keep-alive should never interrupt the UI.
            });
        }

        pingBackend();

        const intervalId = window.setInterval(
            pingBackend,
            KEEP_ALIVE_INTERVAL_MS,
        );

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get("invite");
        const pendingInviteToken = localStorage.getItem("pendingInviteToken");

        if (tokenFromUrl) {
            setInviteToken(tokenFromUrl);
            localStorage.setItem("pendingInviteToken", tokenFromUrl);
            return;
        }

        if (pendingInviteToken) {
            setInviteToken(pendingInviteToken);
        }
    }, []);

    if (isLoadingSession) {
        return (
            <main className="min-h-screen bg-[#1a1a1a] p-6 text-white">
                Loading...
            </main>
        );
    }

    if (!user) {
        return (
            <>
                <AuthPage
                    onAuthenticated={(authenticatedUser) => {
                        setUser(authenticatedUser);

                        const pendingInviteToken =
                            localStorage.getItem("pendingInviteToken");
                        if (pendingInviteToken) {
                            setInviteToken(pendingInviteToken);
                        }
                    }}
                />

                {inviteToken ? (
                    <InviteModal
                        token={inviteToken}
                        user={user}
                        onClose={() => {
                            localStorage.removeItem("pendingInviteToken");
                            setInviteToken(null);
                            clearInviteUrl();
                        }}
                        onAccepted={() => {
                            localStorage.removeItem("pendingInviteToken");
                            setInviteToken(null);
                            clearInviteUrl();
                            setDashboardRefreshKey((key) => key + 1);
                        }}
                        onNeedAuth={() => {
                            setInviteToken(null);
                            clearInviteUrl();
                        }}
                    />
                ) : null}
            </>
        );
    }

    return (
        <>
            {activeMapFriendship ? (
                <MapPage
                    currentUserId={user.id}
                    currentUsername={user.leetcode_username}
                    friendshipId={activeMapFriendship.friendshipId}
                    friendId={activeMapFriendship.friendId}
                    friendUsername={activeMapFriendship.friendUsername}
                    onBack={() => setActiveMapFriendship(null)}
                />
            ) : (
                <DashboardPage
                    user={user}
                    refreshKey={dashboardRefreshKey}
                    onLogout={() => {
                        localStorage.removeItem("accessToken");
                        setUser(null);
                    }}
                    onOpenMap={(friendshipId, friendId, friendUsername) =>
                        setActiveMapFriendship({ friendshipId, friendId, friendUsername })
                    }
                />
            )}

            {inviteToken ? (
                <InviteModal
                    token={inviteToken}
                    user={user}
                    onClose={() => {
                        localStorage.removeItem("pendingInviteToken");
                        setInviteToken(null);
                        clearInviteUrl();
                    }}
                    onAccepted={() => {
                        localStorage.removeItem("pendingInviteToken");
                        setInviteToken(null);
                        clearInviteUrl();
                        setDashboardRefreshKey((key) => key + 1);
                    }}
                    onNeedAuth={() => {
                        setInviteToken(null);
                        clearInviteUrl();
                    }}
                />
            ) : null}
        </>
    );
}
