import { apiRequest } from "../../api/client";
import type { GeneratedMapDraft, LobbyMapSelection } from "./types";

type LobbyMapSelectionResponse = {
    selection: unknown;
};

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

export function normalizeLobbyMapSelection(value: unknown): LobbyMapSelection {
    if (!value || typeof value !== "object") return { kind: "default" };
    const selection = value as Partial<LobbyMapSelection>;
    if (selection.kind === "generated" && isGeneratedMapDraft(selection.draft)) {
        return { kind: "generated", draft: selection.draft };
    }
    return { kind: "default" };
}

export async function fetchLobbyMapSelection(lobbyId: number): Promise<LobbyMapSelection> {
    const data = await apiRequest<LobbyMapSelectionResponse>(`/lobbies/${lobbyId}/map-selection`);
    return normalizeLobbyMapSelection(data.selection);
}

export async function saveLobbyMapSelection(
    lobbyId: number,
    selection: LobbyMapSelection,
): Promise<LobbyMapSelection> {
    const data = await apiRequest<LobbyMapSelectionResponse>(`/lobbies/${lobbyId}/map-selection`, {
        method: "PUT",
        body: JSON.stringify(selection),
    });
    return normalizeLobbyMapSelection(data.selection);
}
