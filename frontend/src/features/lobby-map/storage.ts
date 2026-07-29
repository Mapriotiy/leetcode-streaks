import type { GeneratedMapDraft, LobbyMapSelection } from "./types";

export function lobbyMapStorageKey(lobbyId: number) {
    return `lobby-${lobbyId}-map-selection`;
}

function isGeneratedMapDraft(value: unknown): value is GeneratedMapDraft {
    if (!value || typeof value !== "object") return false;
    const draft = value as Partial<GeneratedMapDraft>;
    return (
        draft.schemaVersion === 1 &&
        Array.isArray(draft.islands) &&
        Array.isArray(draft.provinces) &&
        Array.isArray(draft.regions) &&
        typeof draft.seaBaseSrc === "string"
    );
}

export function readLobbyMapSelection(lobbyId: number): LobbyMapSelection {
    try {
        const raw = localStorage.getItem(lobbyMapStorageKey(lobbyId));
        if (!raw) return { kind: "default" };
        const parsed = JSON.parse(raw) as LobbyMapSelection;
        if (parsed?.kind === "generated" && isGeneratedMapDraft(parsed.draft)) return parsed;
    } catch {}
    return { kind: "default" };
}

export function writeLobbyMapSelection(lobbyId: number, selection: LobbyMapSelection) {
    if (selection.kind === "default") {
        localStorage.removeItem(lobbyMapStorageKey(lobbyId));
        return;
    }
    localStorage.setItem(lobbyMapStorageKey(lobbyId), JSON.stringify(selection));
}
