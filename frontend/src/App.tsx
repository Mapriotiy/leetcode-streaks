import { useEffect, useState } from "react";
import { apiRequest } from "./api/client";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";

type User = {
    id: number;
    leetcode_username: string;
};

export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoadingSession, setIsLoadingSession] = useState(true);

    useEffect(() => {
        apiRequest<User>("/auth/me")
            .then(setUser)
            .catch(() => {
                localStorage.removeItem("accessToken");
                setUser(null);
            })
            .finally(() => setIsLoadingSession(false));
    }, []);

    if (isLoadingSession) {
        return (
            <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
                Loading...
            </main>
        );
    }

    if (!user) {
        return <AuthPage onAuthenticated={setUser} />;
    }

    return (
        <DashboardPage
            user={user}
            onLogout={() => {
                localStorage.removeItem("accessToken");
                setUser(null);
            }}
        />
    );
}