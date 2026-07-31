import { useEffect, useMemo, useState } from "react";
import { Bookmark, Check, Map as MapIcon, Pencil, RotateCcw, Shuffle, Trash2, X } from "lucide-react";
import ProvinceMap from "../../components/ProvinceMap";
import { createMapPreset, deleteMapPreset, listMapPresets, type MapPreset } from "./api";
import { MAP_SIZE_CONFIG } from "./assets";
import { generateMapDraft, reassignRegions } from "./generatorClient";
import { GeneratedMapRenderer } from "./GeneratedMapRenderer";
import type { GeneratedMapDraft, GeneratedMapSize, LobbyMapSelection, LobbyMapTopic } from "./types";

type MapChooserModalProps = {
    open: boolean;
    availableTopics: LobbyMapTopic[];
    currentSelection: LobbyMapSelection;
    onClose: () => void;
    onSelect: (selection: LobbyMapSelection) => void | Promise<void>;
};

type CatalogPreview = { kind: "default" } | { kind: "preset"; preset: MapPreset };

const SIZE_ORDER = ["small", "medium", "large"] as const satisfies readonly GeneratedMapSize[];

// Stable references so the default-map preview doesn't re-mount ProvinceMap on every render.
const EMPTY_CAPTURED = new Map<string, string>();
function noopSelect() {}

function normalizeTopicIds(topics: LobbyMapTopic[], selected: readonly string[]) {
    const known = new Set(topics.map((topic) => topic.id));
    const filtered = selected.filter((id) => known.has(id));
    return filtered.length ? filtered : topics.slice(0, 1).map((topic) => topic.id);
}

function catalogCardClass(active: boolean) {
    return `flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition ${
        active
            ? "border-[#ffa116] bg-[#2a2418]"
            : "border-white/10 bg-[#242424] hover:border-[#ffa116]/60"
    }`;
}

export function MapChooserModal({
    open,
    availableTopics,
    currentSelection,
    onClose,
    onSelect,
}: MapChooserModalProps) {
    const [tab, setTab] = useState<"catalog" | "custom">("catalog");
    const [size, setSize] = useState<GeneratedMapSize>("medium");
    const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(() => availableTopics.map((topic) => topic.id));
    const [draft, setDraft] = useState<GeneratedMapDraft | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [presets, setPresets] = useState<MapPreset[]>([]);
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [catalogPreview, setCatalogPreview] = useState<CatalogPreview>({ kind: "default" });

    const selectedTopics = useMemo(() => {
        const ids = new Set(normalizeTopicIds(availableTopics, selectedTopicIds));
        return availableTopics.filter((topic) => ids.has(topic.id));
    }, [availableTopics, selectedTopicIds]);

    const isDefaultCurrent = currentSelection.kind === "default";
    function isPresetCurrent(preset: MapPreset) {
        return currentSelection.kind === "generated" && currentSelection.draft.id === preset.draft.id;
    }

    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        // Assume the catalog until we know otherwise; corrected below once presets load.
        setTab("catalog");
        setCatalogPreview({ kind: "default" });
        setDraft(null);
        setSelectedTopicIds(availableTopics.map((topic) => topic.id));

        listMapPresets()
            .then((loaded) => {
                if (cancelled) return;
                setPresets(loaded);
                if (currentSelection.kind !== "generated") return;

                const matched = loaded.find((preset) => preset.draft.id === currentSelection.draft.id);
                if (matched) {
                    setCatalogPreview({ kind: "preset", preset: matched });
                    return;
                }

                // A generated draft that isn't a saved preset can only be edited from Custom.
                setTab("custom");
                setSize(currentSelection.draft.size);
                setDraft(currentSelection.draft);
                setSelectedTopicIds(currentSelection.draft.topics.map((topic) => topic.id));
            })
            .catch(() => {
                // Presets are a convenience; a load failure shouldn't block the chooser.
            });

        return () => {
            cancelled = true;
        };
    }, [availableTopics, currentSelection, open]);

    async function saveCurrentAsPreset() {
        if (!draft) return;
        const name = window.prompt("Preset name")?.trim();
        if (!name) return;

        setIsSavingPreset(true);
        setError(null);
        try {
            const preset = await createMapPreset(name, draft);
            setPresets((current) => [preset, ...current]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save preset");
        } finally {
            setIsSavingPreset(false);
        }
    }

    function editPresetInCustom(preset: MapPreset) {
        setError(null);
        setSize(preset.draft.size);
        setDraft(preset.draft);
        setSelectedTopicIds(preset.draft.topics.map((topic) => topic.id));
        setTab("custom");
    }

    async function removePreset(preset: MapPreset) {
        const previous = presets;
        setPresets((current) => current.filter((item) => item.id !== preset.id));
        if (catalogPreview.kind === "preset" && catalogPreview.preset.id === preset.id) {
            setCatalogPreview({ kind: "default" });
        }
        try {
            await deleteMapPreset(preset.id);
        } catch (e) {
            setPresets(previous);
            setError(e instanceof Error ? e.message : "Failed to delete preset");
        }
    }

    async function generateNextDraft(nextSize = size) {
        setIsGenerating(true);
        setError(null);
        try {
            const nextDraft = await generateMapDraft({
                size: nextSize,
                topics: selectedTopics,
            });
            setDraft(nextDraft);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to generate map");
        } finally {
            setIsGenerating(false);
        }
    }

    async function applyTopicsOnly() {
        if (!draft || draft.size !== size) {
            await generateNextDraft();
            return;
        }

        setIsGenerating(true);
        setError(null);
        try {
            setDraft(await reassignRegions(draft, selectedTopics));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to update regions");
        } finally {
            setIsGenerating(false);
        }
    }

    function toggleTopic(topicId: string) {
        setSelectedTopicIds((ids) => {
            if (ids.includes(topicId)) {
                if (ids.length === 1) return ids;
                return ids.filter((id) => id !== topicId);
            }
            return [...ids, topicId];
        });
    }

    async function applySelection(selection: LobbyMapSelection) {
        setIsApplying(true);
        setError(null);
        try {
            await onSelect(selection);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save map");
        } finally {
            setIsApplying(false);
        }
    }

    function chooseDefault() {
        void applySelection({ kind: "default" });
    }

    function chooseCatalogPreview() {
        if (catalogPreview.kind === "default") {
            chooseDefault();
            return;
        }
        void applySelection({ kind: "generated", draft: catalogPreview.preset.draft });
    }

    function chooseGenerated() {
        if (!draft) return;
        void applySelection({ kind: "generated", draft });
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/70 p-2 text-white sm:p-4" onMouseDown={onClose}>
            <div
                className="mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#202020] shadow-2xl sm:h-[92vh]"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="flex items-center justify-between border-b border-white/10 px-3 py-2 sm:px-4 sm:py-3">
                    <div>
                        <h2 className="text-lg font-semibold tracking-normal">Choose Map</h2>
                        <p className="mt-0.5 hidden text-sm text-[#9a9a9a] sm:block">Catalog preset or generated lobby draft</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-[#2a2a2a] text-[#bdbdbd] transition hover:border-[#ffa116]/60 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[260px_1fr]">
                    <aside className="shrink-0 border-b border-white/10 p-3 md:overflow-auto md:border-b-0 md:border-r md:p-4">
                        <div className="grid grid-cols-2 gap-2">
                            {(["catalog", "custom"] as const).map((nextTab) => (
                                <button
                                    key={nextTab}
                                    type="button"
                                    onClick={() => setTab(nextTab)}
                                    className={`h-9 rounded-md border text-sm font-medium ${
                                        tab === nextTab
                                            ? "border-[#ffa116] bg-[#ffa116] text-[#171717]"
                                            : "border-white/10 bg-[#262626] text-[#d7d7d7] hover:border-[#ffa116]/60"
                                    }`}
                                >
                                    {nextTab === "catalog" ? "Catalog" : "Custom"}
                                </button>
                            ))}
                        </div>

                        {tab === "catalog" ? (
                            <div className="mt-3 space-y-2 md:mt-4 md:max-h-[70vh] md:space-y-2 md:overflow-auto md:pr-1">
                                <button
                                    type="button"
                                    onClick={() => setCatalogPreview({ kind: "default" })}
                                    className={catalogCardClass(catalogPreview.kind === "default")}
                                >
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#ffa116]/15 text-[#ffa116]">
                                        <MapIcon size={18} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold text-white">Default Map</span>
                                        <span className="mt-0.5 block text-xs text-[#9a9a9a]">Current production layout</span>
                                    </span>
                                    {isDefaultCurrent ? <Check size={16} className="shrink-0 text-[#ffa116]" /> : null}
                                </button>

                                {presets.length === 0 ? (
                                    <p className="px-1 text-xs text-[#777]">
                                        Generate a map from the Custom tab, then "Save preset" to add it here.
                                    </p>
                                ) : (
                                    presets.map((preset) => (
                                        <div key={preset.id} className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setCatalogPreview({ kind: "preset", preset })}
                                                className={catalogCardClass(
                                                    catalogPreview.kind === "preset" && catalogPreview.preset.id === preset.id,
                                                )}
                                            >
                                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/5 text-[#ffa116]">
                                                    <Bookmark size={16} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-white">{preset.name}</span>
                                                    <span className="mt-0.5 block text-xs text-[#9a9a9a]">
                                                        {MAP_SIZE_CONFIG[preset.draft.size].label} · {preset.draft.provinceCount} provinces
                                                    </span>
                                                </span>
                                                {isPresetCurrent(preset) ? <Check size={16} className="shrink-0 text-[#ffa116]" /> : null}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removePreset(preset)}
                                                aria-label={`Delete preset ${preset.name}`}
                                                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-[#242424] text-[#8a8a8a] transition hover:text-red-400"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="mt-3 space-y-3 md:mt-4 md:space-y-4">
                                <div>
                                    <p className="mb-2 text-xs uppercase tracking-wide text-[#888]">Size</p>
                                    <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                                        {SIZE_ORDER.map((nextSize) => {
                                            const config = MAP_SIZE_CONFIG[nextSize];
                                            const active = size === nextSize;
                                            return (
                                                <button
                                                    key={nextSize}
                                                    type="button"
                                                    onClick={() => {
                                                        setSize(nextSize);
                                                        setDraft(null);
                                                    }}
                                                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                                                        active
                                                            ? "border-[#ffa116] bg-[#ffa116]/12 text-white"
                                                            : "border-white/10 bg-[#262626] text-[#d7d7d7] hover:border-[#ffa116]/60"
                                                    }`}
                                                >
                                                    <span>{config.label}</span>
                                                    <span className="text-xs text-[#9a9a9a]">~{config.target}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <p className="mb-2 text-xs uppercase tracking-wide text-[#888]">Topics</p>
                                    <div className="flex gap-2 overflow-x-auto pb-1 md:block md:max-h-72 md:space-y-2 md:overflow-auto md:pb-0 md:pr-1">
                                        {availableTopics.map((topic) => {
                                            const checked = selectedTopicIds.includes(topic.id);
                                            return (
                                                <button
                                                    key={topic.id}
                                                    type="button"
                                                    onClick={() => toggleTopic(topic.id)}
                                                    className={`flex min-w-[150px] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition md:w-full md:min-w-0 ${
                                                        checked
                                                            ? "border-white/20 bg-[#2d2d2d] text-white"
                                                            : "border-white/10 bg-[#242424] text-[#9a9a9a] hover:border-white/20"
                                                    }`}
                                                >
                                                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: topic.color }} />
                                                    <span className="min-w-0 flex-1">{topic.name}</span>
                                                    {checked ? <Check size={15} className="text-[#ffa116]" /> : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </aside>

                    <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 md:overflow-auto md:p-4">
                        {tab === "catalog" ? (
                            <div className="flex min-h-0 flex-1 flex-col gap-3">
                                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-sm text-[#bdbdbd]">
                                        {catalogPreview.kind === "default"
                                            ? "Production map layout"
                                            : `${catalogPreview.preset.draft.provinceCount} provinces / ${catalogPreview.preset.draft.regionCount} regions`}
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        {catalogPreview.kind === "preset" ? (
                                            <button
                                                type="button"
                                                onClick={() => editPresetInCustom(catalogPreview.preset)}
                                                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-white/10 bg-[#2a2a2a] px-2 text-xs text-[#d7d7d7] transition hover:border-[#ffa116]/60 sm:gap-2 sm:px-3 sm:text-sm"
                                            >
                                                <Pencil size={15} />
                                                <span className="hidden sm:inline">Customize</span>
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={chooseCatalogPreview}
                                            disabled={isApplying}
                                            className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-[#ffa116] bg-[#ffa116] px-2 text-xs font-semibold text-[#171717] disabled:cursor-not-allowed disabled:border-[#5f4a25] disabled:bg-[#5f4a25] disabled:text-[#a0a0a0] sm:gap-2 sm:px-3 sm:text-sm"
                                        >
                                            <Check size={15} />
                                            {isApplying ? "Saving..." : "Use This Map"}
                                        </button>
                                    </div>
                                </div>

                                {error ? (
                                    <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                        {error}
                                    </p>
                                ) : null}

                                <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-[#191919] text-center">
                                    {catalogPreview.kind === "default" ? (
                                        <div className="flex h-full items-center justify-center p-4">
                                            <div className="w-full max-w-xl">
                                                <ProvinceMap captured={EMPTY_CAPTURED} onSelect={noopSelect} highlightedProvinces={null} />
                                            </div>
                                        </div>
                                    ) : (
                                        <GeneratedMapRenderer draft={catalogPreview.preset.draft} fitHeight className="mx-auto" />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col gap-3">
                                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-sm text-[#bdbdbd]">
                                        {draft ? `${draft.provinceCount} provinces / ${draft.regionCount} regions` : "No generated draft yet"}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                                        <button
                                            type="button"
                                            onClick={applyTopicsOnly}
                                            disabled={isGenerating || selectedTopics.length === 0}
                                            className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-white/10 bg-[#2a2a2a] px-2 text-xs text-[#d7d7d7] transition hover:border-[#ffa116]/60 disabled:cursor-not-allowed disabled:text-[#777] sm:gap-2 sm:px-3 sm:text-sm"
                                        >
                                            <RotateCcw size={15} />
                                            <span className="hidden sm:inline">Apply Topics</span>
                                            <span className="sm:hidden">Topics</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => generateNextDraft()}
                                            disabled={isGenerating || selectedTopics.length === 0}
                                            className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-white/10 bg-[#2a2a2a] px-2 text-xs text-[#d7d7d7] transition hover:border-[#ffa116]/60 disabled:cursor-not-allowed disabled:text-[#777] sm:gap-2 sm:px-3 sm:text-sm"
                                        >
                                            <Shuffle size={15} />
                                            {isGenerating ? "Generating..." : "Reroll"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={saveCurrentAsPreset}
                                            disabled={!draft || isGenerating || isSavingPreset}
                                            className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-white/10 bg-[#2a2a2a] px-2 text-xs text-[#d7d7d7] transition hover:border-[#ffa116]/60 disabled:cursor-not-allowed disabled:text-[#777] sm:gap-2 sm:px-3 sm:text-sm"
                                        >
                                            <Bookmark size={15} />
                                            <span className="hidden sm:inline">{isSavingPreset ? "Saving..." : "Save preset"}</span>
                                            <span className="sm:hidden">Save</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={chooseGenerated}
                                            disabled={!draft || isGenerating || isApplying}
                                            className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-[#ffa116] bg-[#ffa116] px-2 text-xs font-semibold text-[#171717] disabled:cursor-not-allowed disabled:border-[#5f4a25] disabled:bg-[#5f4a25] disabled:text-[#a0a0a0] sm:gap-2 sm:px-3 sm:text-sm"
                                        >
                                            <Check size={15} />
                                            {isApplying ? "Saving..." : "Use Map"}
                                        </button>
                                    </div>
                                </div>

                                {error ? (
                                    <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                        {error}
                                    </p>
                                ) : null}

                                {draft ? (
                                    <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-[#191919] text-center">
                                        <GeneratedMapRenderer draft={draft} fitHeight className="mx-auto" />
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => generateNextDraft()}
                                        disabled={isGenerating || selectedTopics.length === 0}
                                        className="flex min-h-[280px] flex-1 items-center justify-center rounded-lg border border-dashed border-white/15 bg-[#191919] text-sm font-medium text-[#bdbdbd] transition hover:border-[#ffa116]/60 hover:text-white disabled:cursor-not-allowed disabled:text-[#777] md:min-h-[420px]"
                                    >
                                        {isGenerating ? "Generating..." : "Generate Map"}
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
