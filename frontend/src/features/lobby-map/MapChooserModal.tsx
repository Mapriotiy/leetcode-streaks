import { useEffect, useMemo, useState } from "react";
import { Check, Map, RotateCcw, Shuffle, X } from "lucide-react";
import { MAP_SIZE_CONFIG } from "./assets";
import { createGeneratedMapDraft, reassignGeneratedMapRegions } from "./generator";
import { GeneratedMapRenderer } from "./GeneratedMapRenderer";
import type { GeneratedMapDraft, GeneratedMapSize, LobbyMapSelection, LobbyMapTopic } from "./types";

type MapChooserModalProps = {
    open: boolean;
    availableTopics: LobbyMapTopic[];
    currentSelection: LobbyMapSelection;
    onClose: () => void;
    onSelect: (selection: LobbyMapSelection) => void | Promise<void>;
};

const SIZE_ORDER = ["small", "medium", "large"] as const satisfies readonly GeneratedMapSize[];

function normalizeTopicIds(topics: LobbyMapTopic[], selected: readonly string[]) {
    const known = new Set(topics.map((topic) => topic.id));
    const filtered = selected.filter((id) => known.has(id));
    return filtered.length ? filtered : topics.slice(0, 1).map((topic) => topic.id);
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

    const selectedTopics = useMemo(() => {
        const ids = new Set(normalizeTopicIds(availableTopics, selectedTopicIds));
        return availableTopics.filter((topic) => ids.has(topic.id));
    }, [availableTopics, selectedTopicIds]);

    useEffect(() => {
        if (!open) return;
        if (currentSelection.kind === "generated") {
            setTab("custom");
            setSize(currentSelection.draft.size);
            setDraft(currentSelection.draft);
            setSelectedTopicIds(currentSelection.draft.topics.map((topic) => topic.id));
            return;
        }
        setTab("catalog");
        setDraft(null);
        setSelectedTopicIds(availableTopics.map((topic) => topic.id));
    }, [availableTopics, currentSelection, open]);

    async function generateNextDraft(nextSize = size) {
        setIsGenerating(true);
        setError(null);
        try {
            const nextDraft = await createGeneratedMapDraft({
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
            setDraft(await reassignGeneratedMapRegions(draft, selectedTopics));
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

    function chooseGenerated() {
        if (!draft) return;
        void applySelection({ kind: "generated", draft });
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 text-white" onMouseDown={onClose}>
            <div
                className="mx-auto flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#202020] shadow-2xl"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div>
                        <h2 className="text-lg font-semibold tracking-normal">Choose Map</h2>
                        <p className="mt-0.5 text-sm text-[#9a9a9a]">Catalog preset or generated lobby draft</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-[#2a2a2a] text-[#bdbdbd] transition hover:border-[#ffa116]/60 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[260px_1fr]">
                    <aside className="border-b border-white/10 p-4 md:border-b-0 md:border-r">
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
                            <button
                                type="button"
                                onClick={chooseDefault}
                                className="mt-4 flex w-full items-center gap-3 rounded-md border border-[#ffa116]/50 bg-[#2a2418] px-3 py-3 text-left transition hover:border-[#ffa116]"
                            >
                                <span className="grid h-9 w-9 place-items-center rounded-md bg-[#ffa116]/15 text-[#ffa116]">
                                            <Map size={18} />
                                        </span>
                                <span>
                                    <span className="block text-sm font-semibold text-white">Default Map</span>
                                    <span className="mt-0.5 block text-xs text-[#9a9a9a]">Current production layout</span>
                                </span>
                            </button>
                        ) : (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <p className="mb-2 text-xs uppercase tracking-wide text-[#888]">Size</p>
                                    <div className="grid gap-2">
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
                                    <div className="max-h-72 space-y-2 overflow-auto pr-1">
                                        {availableTopics.map((topic) => {
                                            const checked = selectedTopicIds.includes(topic.id);
                                            return (
                                                <button
                                                    key={topic.id}
                                                    type="button"
                                                    onClick={() => toggleTopic(topic.id)}
                                                    className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
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

                    <section className="min-h-0 overflow-auto p-4">
                        {tab === "catalog" ? (
                            <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-white/10 bg-[#191919]">
                                <div className="text-center">
                                    <p className="text-sm text-[#bdbdbd]">Default map is selected from the production map component.</p>
                                    <button
                                        type="button"
                                        onClick={chooseDefault}
                                        disabled={isApplying}
                                        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#ffa116] bg-[#ffa116] px-4 text-sm font-semibold text-[#171717]"
                                    >
                                        <Check size={16} />
                                        Use Default
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-sm text-[#bdbdbd]">
                                        {draft ? `${draft.provinceCount} provinces / ${draft.regionCount} regions` : "No generated draft yet"}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={applyTopicsOnly}
                                            disabled={isGenerating || selectedTopics.length === 0}
                                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-[#2a2a2a] px-3 text-sm text-[#d7d7d7] transition hover:border-[#ffa116]/60 disabled:cursor-not-allowed disabled:text-[#777]"
                                        >
                                            <RotateCcw size={15} />
                                            Apply Topics
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => generateNextDraft()}
                                            disabled={isGenerating || selectedTopics.length === 0}
                                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-[#2a2a2a] px-3 text-sm text-[#d7d7d7] transition hover:border-[#ffa116]/60 disabled:cursor-not-allowed disabled:text-[#777]"
                                        >
                                            <Shuffle size={15} />
                                            {isGenerating ? "Generating..." : "Reroll"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={chooseGenerated}
                                            disabled={!draft || isGenerating || isApplying}
                                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#ffa116] bg-[#ffa116] px-3 text-sm font-semibold text-[#171717] disabled:cursor-not-allowed disabled:border-[#5f4a25] disabled:bg-[#5f4a25] disabled:text-[#a0a0a0]"
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
                                    <GeneratedMapRenderer draft={draft} />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => generateNextDraft()}
                                        disabled={isGenerating || selectedTopics.length === 0}
                                        className="flex min-h-[420px] w-full items-center justify-center rounded-lg border border-dashed border-white/15 bg-[#191919] text-sm font-medium text-[#bdbdbd] transition hover:border-[#ffa116]/60 hover:text-white disabled:cursor-not-allowed disabled:text-[#777]"
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
