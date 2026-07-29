import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { MAP_ASPECT_RATIO, mapAssetUrl } from "./assets";
import type { GeneratedMapDraft, GeneratedMapIsland } from "./types";

type GeneratedMapRendererProps = {
    draft: GeneratedMapDraft;
    captured?: Map<string, string>;
    highlightedProvinces?: string[] | null;
    onSelect?: (id: string, pos: { x: number; y: number }) => void;
    className?: string;
    showBack?: boolean;
    showFill?: boolean;
    overlayOpacity?: number;
    strokeWidth?: number;
};

type ProvinceMarker = {
    provinceId: string;
    provinceName: string;
    left: number;
    top: number;
    color: string | null;
};

function setSvgAttr(tag: string, name: string, value: string) {
    const attrPattern = new RegExp(`\\s${name}="[^"]*"`);
    if (attrPattern.test(tag)) return tag.replace(attrPattern, ` ${name}="${value}"`);
    return tag.replace(/\/?>$/, (ending) => ` ${name}="${value}"${ending}`);
}

function resolveCaptureColor(owner: string | undefined): string | null {
    if (!owner) return null;
    if (owner === "player") return "#00e5ff";
    if (owner === "enemy") return "#ff2d55";
    return owner;
}

function maskStyle(path: string): CSSProperties {
    const url = `url("${mapAssetUrl(path)}")`;
    return {
        maskImage: url,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "100% 100%",
        WebkitMaskImage: url,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "100% 100%",
    };
}

function getAttr(tag: string, name: string) {
    const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "i"));
    return match?.[1] ?? match?.[2] ?? null;
}

function parseViewBox(svgText: string) {
    const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] ?? "";
    const viewBox = getAttr(svgTag, "viewBox");
    if (viewBox) {
        const values = viewBox.trim().split(/[\s,]+/).map(Number);
        if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
            return { x: values[0], y: values[1], width: values[2], height: values[3] };
        }
    }

    const width = Number(getAttr(svgTag, "width"));
    const height = Number(getAttr(svgTag, "height"));
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return { x: 0, y: 0, width, height };
    }

    return { x: 0, y: 0, width: 100, height: 100 };
}

function pathCentroidFromTag(pathTag: string, fallbackIndex: number) {
    const d = getAttr(pathTag, "d") ?? "";
    const values = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    if (values.length < 2) return { x: fallbackIndex, y: fallbackIndex };

    let x = 0;
    let y = 0;
    let count = 0;
    for (let index = 0; index < values.length - 1; index += 2) {
        x += values[index];
        y += values[index + 1];
        count += 1;
    }
    return count ? { x: x / count, y: y / count } : { x: fallbackIndex, y: fallbackIndex };
}

function clampPercent(value: number) {
    return Math.max(4, Math.min(96, value));
}

function islandMarkers({
    svgText,
    island,
    draft,
    captured,
}: {
    svgText: string;
    island: GeneratedMapIsland;
    draft: GeneratedMapDraft;
    captured: Map<string, string>;
}): ProvinceMarker[] {
    const viewBox = parseViewBox(svgText);
    const provinceByPath = new Map(
        draft.provinces
            .filter((province) => province.islandId === island.islandId)
            .map((province) => [province.pathIndex, province]),
    );

    return [...svgText.matchAll(/<path\b[^>]*>/g)]
        .map((match) => match[0])
        .map((pathTag, pathIndex) => {
            const province = provinceByPath.get(pathIndex);
            if (!province) return null;
            const centroid = pathCentroidFromTag(pathTag, pathIndex);
            return {
                provinceId: province.provinceId,
                provinceName: province.name,
                left: clampPercent(((centroid.x - viewBox.x) / viewBox.width) * 100),
                top: clampPercent(((centroid.y - viewBox.y) / viewBox.height) * 100),
                color: resolveCaptureColor(captured.get(province.provinceId)),
            } satisfies ProvinceMarker;
        })
        .filter((marker): marker is ProvinceMarker => marker !== null);
}

export function renderGeneratedIslandSvg({
    svgText,
    island,
    draft,
    captured,
    highlightedProvinces,
}: {
    svgText: string;
    island: GeneratedMapIsland;
    draft: GeneratedMapDraft;
    captured: Map<string, string>;
    highlightedProvinces: string[] | null;
}) {
    const provinceByPath = new Map(
        draft.provinces
            .filter((province) => province.islandId === island.islandId)
            .map((province) => [province.pathIndex, province]),
    );
    const regionById = new Map(draft.regions.map((region) => [region.regionId, region]));
    let pathIndex = 0;

    return svgText
        .replace(
            /<svg\b([^>]*)>/,
            '<svg$1 class="generated-map-svg" preserveAspectRatio="none" aria-hidden="true">',
        )
        .replace(/<path\b[^>]*>/g, (tag) => {
            const province = provinceByPath.get(pathIndex);
            const region = province ? regionById.get(province.regionId) : null;
            const provinceId = province?.provinceId ?? `${island.islandId}-province-${String(pathIndex + 1).padStart(3, "0")}`;
            const provinceName = province?.name ?? provinceId;
            const capturedColor = resolveCaptureColor(captured.get(provinceId));
            const isHighlighted = highlightedProvinces ? highlightedProvinces.includes(provinceId) : true;
            const fill = capturedColor ?? region?.color ?? "#5b4d3f";
            const stroke = capturedColor ?? "#ffad42";
            const filter = capturedColor ? `drop-shadow(0 0 6px ${capturedColor}) drop-shadow(0 0 12px ${capturedColor})` : "";
            const inlineStyle = [
                `--generated-map-region-color: ${fill}`,
                `--generated-map-capture-color: ${capturedColor ?? "#ffad42"}`,
            ].join("; ");
            pathIndex += 1;

            let nextTag = tag;
            nextTag = setSvgAttr(nextTag, "style", inlineStyle);
            nextTag = setSvgAttr(nextTag, "id", provinceId);
            nextTag = setSvgAttr(nextTag, "class", "generated-map-province");
            nextTag = setSvgAttr(nextTag, "data-province-id", provinceId);
            nextTag = setSvgAttr(nextTag, "data-province-name", provinceName);
            nextTag = setSvgAttr(nextTag, "data-region-id", province?.regionId ?? "region-01");
            nextTag = setSvgAttr(nextTag, "data-muted", highlightedProvinces && !isHighlighted ? "true" : "false");
            nextTag = setSvgAttr(nextTag, "data-captured", capturedColor ? "true" : "false");
            nextTag = setSvgAttr(nextTag, "fill", fill);
            nextTag = setSvgAttr(nextTag, "fill-opacity", "1");
            nextTag = setSvgAttr(nextTag, "opacity", "1");
            nextTag = setSvgAttr(nextTag, "stroke", stroke);
            if (filter) nextTag = setSvgAttr(nextTag, "filter", filter);
            return nextTag;
        });
}

export function GeneratedMapRenderer({
    draft,
    captured = new Map(),
    highlightedProvinces = null,
    onSelect,
    className = "",
    showBack = true,
    showFill = true,
    overlayOpacity = 0.68,
    strokeWidth = 1.15,
}: GeneratedMapRendererProps) {
    const [svgTexts, setSvgTexts] = useState<Record<string, string>>({});
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        setSvgTexts({});

        Promise.all(
            draft.islands.map(async (island) => {
                const response = await fetch(mapAssetUrl(island.svgPath));
                if (!response.ok) throw new Error(`${island.svgPath}: ${response.status} ${response.statusText}`);
                return [island.islandId, await response.text()] as const;
            }),
        )
            .then((entries) => {
                if (!cancelled) setSvgTexts(Object.fromEntries(entries));
            })
            .catch((error) => {
                if (!cancelled) setLoadError(error instanceof Error ? error.message : "Failed to load map SVG");
            });

        return () => {
            cancelled = true;
        };
    }, [draft]);

    const svgLayerStyle = useMemo(
        () =>
            ({
                "--generated-map-fill-opacity": showFill ? "0.16" : "0",
                "--generated-map-capture-fill-opacity": showFill ? "0.4" : "0",
                "--generated-map-layer-opacity": String(overlayOpacity),
                "--generated-map-stroke-width": String(strokeWidth),
            }) as CSSProperties,
        [overlayOpacity, showFill, strokeWidth],
    );

    const markersByIsland = useMemo(() => {
        const map = new Map<string, ProvinceMarker[]>();
        for (const island of draft.islands) {
            const svgText = svgTexts[island.islandId];
            if (!svgText) continue;
            map.set(island.islandId, islandMarkers({ svgText, island, draft, captured }));
        }
        return map;
    }, [captured, draft, svgTexts]);

    function handleClick(event: MouseEvent<HTMLDivElement>) {
        if (!onSelect) return;
        const target = event.target as Element;
        const path = target.closest<SVGPathElement>(".generated-map-province");
        if (!path) return;
        const provinceId = path.getAttribute("data-province-id") || path.id;
        const rect = path.getBoundingClientRect();
        onSelect(provinceId, {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        });
    }

    return (
        <div
            className={`generated-map-root relative w-full overflow-hidden rounded-lg border border-white/10 shadow-2xl ${className}`}
            style={{ aspectRatio: MAP_ASPECT_RATIO }}
            onClick={handleClick}
        >
            <GeneratedMapStyles />
            <img
                src={mapAssetUrl(draft.seaBaseSrc)}
                alt=""
                className="absolute inset-0 h-full w-full object-fill"
                draggable={false}
            />
            {draft.seaSprites.map((sprite) => (
                <img
                    key={`${sprite.id}-${sprite.left}-${sprite.top}`}
                    src={mapAssetUrl(sprite.src)}
                    alt=""
                    className="pointer-events-none absolute object-contain"
                    draggable={false}
                    style={{
                        left: `${sprite.left}%`,
                        top: `${sprite.top}%`,
                        width: `${sprite.width}%`,
                        opacity: sprite.opacity,
                        transform: "none",
                    }}
                />
            ))}
            {draft.islands.map((island) => {
                const svgText = svgTexts[island.islandId];
                return (
                    <div
                        key={island.islandId}
                        className="absolute"
                        style={{
                            left: `${island.left}%`,
                            top: `${island.top}%`,
                            width: `${island.width}%`,
                            aspectRatio: island.aspectRatio,
                            zIndex: island.zIndex,
                            transform: `rotate(${island.rotation}deg)`,
                            transformOrigin: "center",
                        }}
                    >
                        {showBack ? (
                            <img
                                src={mapAssetUrl(island.backPath)}
                                alt=""
                                className="generated-map-back absolute inset-0 h-full w-full object-fill"
                                draggable={false}
                                style={maskStyle(island.svgPath)}
                            />
                        ) : null}
                        {svgText ? (
                            <div
                                className="absolute inset-0 z-[3]"
                                style={svgLayerStyle}
                                dangerouslySetInnerHTML={{
                                    __html: renderGeneratedIslandSvg({
                                        svgText,
                                        island,
                                        draft,
                                        captured,
                                        highlightedProvinces,
                                    }),
                                }}
                            />
                        ) : null}
                        <div className="pointer-events-none absolute inset-0 z-[6]">
                            {(markersByIsland.get(island.islandId) ?? []).map((marker) => (
                                <span
                                    key={marker.provinceId}
                                    className="generated-map-marker"
                                    data-captured={marker.color ? "true" : "false"}
                                    title={marker.provinceName}
                                    style={{
                                        left: `${marker.left}%`,
                                        top: `${marker.top}%`,
                                        "--generated-marker-color": marker.color ?? "#777777",
                                    } as CSSProperties}
                                >
                                    <span className="generated-map-marker-shell">
                                        {marker.color ? (
                                            <span className="generated-map-marker-flag" />
                                        ) : (
                                            <span className="generated-map-marker-dot" />
                                        )}
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                );
            })}
            {loadError ? (
                <div className="absolute inset-x-4 top-4 rounded-md border border-red-500/30 bg-red-950/70 px-3 py-2 text-sm text-red-200">
                    {loadError}
                </div>
            ) : null}
        </div>
    );
}

function GeneratedMapStyles() {
    return (
        <style>
            {`
                .generated-map-svg {
                    display: block;
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.34));
                }

                .generated-map-back {
                    filter: saturate(0.96) brightness(1.04) contrast(0.98);
                }

                .generated-map-svg .generated-map-province {
                    cursor: pointer;
                    fill: var(--generated-map-region-color) !important;
                    fill-opacity: var(--generated-map-fill-opacity) !important;
                    opacity: var(--generated-map-layer-opacity) !important;
                    stroke: #c77f32 !important;
                    stroke-opacity: 0.48 !important;
                    stroke-width: var(--generated-map-stroke-width) !important;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    vector-effect: non-scaling-stroke;
                    pointer-events: all;
                    transition: fill-opacity 120ms ease, opacity 120ms ease, stroke-opacity 120ms ease, stroke-width 120ms ease;
                }

                .generated-map-svg .generated-map-province[data-muted="true"] {
                    fill-opacity: 0.04 !important;
                    opacity: 0.24 !important;
                    stroke-opacity: 0.16 !important;
                }

                .generated-map-svg .generated-map-province[data-captured="true"] {
                    fill: var(--generated-map-capture-color) !important;
                    fill-opacity: var(--generated-map-capture-fill-opacity) !important;
                    opacity: 0.38 !important;
                    stroke: var(--generated-map-capture-color) !important;
                    stroke-opacity: 1 !important;
                    stroke-width: 5 !important;
                }

                .generated-map-svg .generated-map-province:hover {
                    fill-opacity: 0.22 !important;
                    opacity: 1 !important;
                    stroke-opacity: 0.82 !important;
                    stroke-width: calc(var(--generated-map-stroke-width) + 0.8) !important;
                    filter: drop-shadow(0 0 5px rgba(255, 173, 66, 0.72));
                }

                .generated-map-marker {
                    position: absolute;
                    display: grid;
                    width: clamp(14px, 1.55vw, 20px);
                    aspect-ratio: 1;
                    place-items: center;
                    transform: translate(-50%, -50%);
                    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5));
                }

                .generated-map-marker-shell {
                    position: relative;
                    display: grid;
                    width: 100%;
                    height: 100%;
                    place-items: center;
                    border-radius: 999px;
                    border: 1px solid rgba(160, 160, 160, 0.78);
                    background: rgba(20, 20, 20, 0.88);
                    box-shadow:
                        inset 0 0 0 2px rgba(255, 255, 255, 0.05),
                        0 0 0 2px rgba(0, 0, 0, 0.22);
                }

                .generated-map-marker[data-captured="true"] .generated-map-marker-shell {
                    border-color: var(--generated-marker-color);
                    box-shadow:
                        inset 0 0 0 2px rgba(255, 255, 255, 0.06),
                        0 0 0 2px rgba(0, 0, 0, 0.28),
                        0 0 10px color-mix(in srgb, var(--generated-marker-color) 55%, transparent);
                }

                .generated-map-marker-dot {
                    width: 22%;
                    aspect-ratio: 1;
                    border-radius: 999px;
                    background: #858585;
                }

                .generated-map-marker-flag {
                    position: relative;
                    display: block;
                    width: 42%;
                    height: 58%;
                    border-left: 1.5px solid var(--generated-marker-color);
                }

                .generated-map-marker-flag::after {
                    content: "";
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 80%;
                    height: 42%;
                    background: var(--generated-marker-color);
                    clip-path: polygon(0 0, 100% 28%, 0 58%);
                }
            `}
        </style>
    );
}
