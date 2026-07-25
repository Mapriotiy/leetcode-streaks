const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export async function apiRequest<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const token = localStorage.getItem("accessToken");

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.detail ?? `API error: ${response.status}`;
        throw new Error(message);
    }

    return response.json();
}