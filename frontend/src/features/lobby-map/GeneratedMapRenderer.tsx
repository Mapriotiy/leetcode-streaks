import { Minus, Plus, RotateCcw } from "lucide-react";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent,
    type WheelEvent,
} from "react";
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
    zoomable?: boolean;
    minZoom?: number;
    maxZoom?: number;
    initialZoom?: number;
    fitHeight?: boolean;
};

type ProvinceMarker = {
    provinceId: string;
    provinceName: string;
    left: number;
    top: number;
    color: string | null;
};

type DragState = {
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
};

type PointerPoint = {
    x: number;
    y: number;
};

type PinchState = {
    startDistance: number;
    startZoom: number;
    startPan: PointerPoint;
    startCenter: PointerPoint;
};

const ZOOM_STEP = 0.35;

function clampZoom(value: number, minZoom: number, maxZoom: number) {
    return Math.max(minZoom, Math.min(maxZoom, value));
}

function pointerDistance(a: PointerPoint, b: PointerPoint) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerCenter(a: PointerPoint, b: PointerPoint): PointerPoint {
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
    };
}

function hexToRgb(hex: string) {
    const normalized = hex.trim().replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
    return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
    };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
    return `#${[r, g, b]
        .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
        .join("")}`;
}

function mixHex(base: string, target: string, baseWeight: number) {
    const a = hexToRgb(base);
    const b = hexToRgb(target);
    if (!a || !b) return base;
    const targetWeight = 1 - baseWeight;
    return rgbToHex({
        r: a.r * baseWeight + b.r * targetWeight,
        g: a.g * baseWeight + b.g * targetWeight,
        b: a.b * baseWeight + b.b * targetWeight,
    });
}

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
            const regionColor = region?.color ?? "#8f7458";
            const fill = capturedColor ?? regionColor;
            const stroke = capturedColor ?? regionColor;
            const regionFill = capturedColor ? capturedColor : mixHex(regionColor, "#d8c7a8", 0.42);
            const regionStroke = capturedColor ? capturedColor : mixHex(regionColor, "#f0d9b2", 0.78);
            const filter = capturedColor ? `drop-shadow(0 0 6px ${capturedColor}) drop-shadow(0 0 12px ${capturedColor})` : "";
            const inlineStyle = [
                `--generated-map-region-color: ${regionFill}`,
                `--generated-map-region-stroke-color: ${regionStroke}`,
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
    zoomable = true,
    minZoom = 1,
    maxZoom = 3,
    initialZoom = 1,
    fitHeight = false,
}: GeneratedMapRendererProps) {
    const [svgTexts, setSvgTexts] = useState<Record<string, string>>({});
    const [loadError, setLoadError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(() => clampZoom(initialZoom, minZoom, maxZoom));
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const dragRef = useRef<DragState | null>(null);
    const activePointersRef = useRef<Map<number, PointerPoint>>(new Map());
    const pinchRef = useRef<PinchState | null>(null);

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

    useEffect(() => {
        setZoom(clampZoom(initialZoom, minZoom, maxZoom));
        setPan({ x: 0, y: 0 });
        activePointersRef.current.clear();
        dragRef.current = null;
        pinchRef.current = null;
    }, [draft, initialZoom, maxZoom, minZoom]);

    const svgLayerStyle = useMemo(
        () =>
            ({
                "--generated-map-fill-opacity": showFill ? "0.2" : "0",
                "--generated-map-capture-fill-opacity": showFill ? "0.4" : "0",
                "--generated-map-layer-opacity": String(Math.min(overlayOpacity, 0.58)),
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

    function updateZoom(nextZoom: number) {
        const clamped = clampZoom(nextZoom, minZoom, maxZoom);
        setZoom(clamped);
        if (clamped === minZoom) {
            setPan({ x: 0, y: 0 });
        }
    }

    function resetView() {
        setZoom(clampZoom(initialZoom, minZoom, maxZoom));
        setPan({ x: 0, y: 0 });
    }

    function handleWheel(event: WheelEvent<HTMLDivElement>) {
        if (!zoomable) return;
        event.preventDefault();
        updateZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    }

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        if (!zoomable || event.button !== 0) return;
        if ((event.target as Element).closest("button")) return;
        activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        const activePoints = [...activePointersRef.current.values()];
        if (activePoints.length >= 2) {
            event.currentTarget.setPointerCapture(event.pointerId);
            const [a, b] = activePoints;
            pinchRef.current = {
                startDistance: Math.max(1, pointerDistance(a, b)),
                startZoom: zoom,
                startPan: pan,
                startCenter: pointerCenter(a, b),
            };
            dragRef.current = null;
            return;
        }

        if (zoom <= minZoom) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: pan.x,
            originY: pan.y,
            moved: false,
        };
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        if (activePointersRef.current.has(event.pointerId)) {
            activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }

        const pinch = pinchRef.current;
        if (pinch && activePointersRef.current.size >= 2) {
            const [a, b] = [...activePointersRef.current.values()];
            const nextZoom = clampZoom(
                pinch.startZoom * (pointerDistance(a, b) / pinch.startDistance),
                minZoom,
                maxZoom,
            );
            const center = pointerCenter(a, b);
            setZoom(nextZoom);
            setPan(
                nextZoom === minZoom
                    ? { x: 0, y: 0 }
                    : {
                          x: pinch.startPan.x + center.x - pinch.startCenter.x,
                          y: pinch.startPan.y + center.y - pinch.startCenter.y,
                      },
            );
            return;
        }

        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        setPan({ x: drag.originX + dx, y: drag.originY + dy });
    }

    function findProvincePath(event: PointerEvent<HTMLDivElement>): SVGPathElement | null {
        const directPath = (event.target as Element).closest<SVGPathElement>(".generated-map-province");
        if (directPath) return directPath;

        for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
            const path = element.closest?.(".generated-map-province");
            if (path instanceof SVGPathElement) return path;
        }
        return null;
    }

    function selectProvinceAt(event: PointerEvent<HTMLDivElement>) {
        if (!onSelect) return;
        const path = findProvincePath(event);
        if (!path) return;
        const provinceId = path.getAttribute("data-province-id") || path.id;
        const rect = path.getBoundingClientRect();
        onSelect(provinceId, {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        });
    }

    function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
        const releasePointer = () => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        };

        activePointersRef.current.delete(event.pointerId);
        if (pinchRef.current) {
            if (activePointersRef.current.size < 2) {
                pinchRef.current = null;
            }
            releasePointer();
            return;
        }

        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            selectProvinceAt(event);
            releasePointer();
            return;
        }
        if (!drag.moved) {
            selectProvinceAt(event);
        }
        dragRef.current = null;
        releasePointer();
    }

    const mapLayerStyle: CSSProperties = {
        transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
        transformOrigin: "center",
        transition: dragRef.current ? "none" : "transform 120ms ease",
        cursor: zoomable ? (zoom > minZoom ? "grab" : "zoom-in") : undefined,
    };
    const rootStyle: CSSProperties = fitHeight
        ? { aspectRatio: MAP_ASPECT_RATIO, height: "100%", minWidth: "100%" }
        : { aspectRatio: MAP_ASPECT_RATIO };

    return (
        <div
            className={`generated-map-root relative overflow-hidden rounded-lg border border-white/10 shadow-2xl ${
                fitHeight ? "inline-block align-top" : "w-full"
            } ${
                zoomable ? "touch-none select-none" : ""
            } ${className}`}
            style={rootStyle}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <GeneratedMapStyles />
            {zoomable ? (
                <div className="absolute right-2 top-2 z-20 hidden items-center gap-1 rounded-md border border-white/10 bg-[#1b1b1b]/85 p-1 shadow-lg backdrop-blur sm:flex">
                    <button
                        type="button"
                        onClick={() => updateZoom(zoom - ZOOM_STEP)}
                        disabled={zoom <= minZoom}
                        title="Zoom out"
                        aria-label="Zoom out"
                        className="grid h-8 w-8 place-items-center rounded bg-[#2a2a2a] text-[#d7d7d7] transition hover:text-white disabled:cursor-not-allowed disabled:text-[#666]"
                    >
                        <Minus size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => updateZoom(zoom + ZOOM_STEP)}
                        disabled={zoom >= maxZoom}
                        title="Zoom in"
                        aria-label="Zoom in"
                        className="grid h-8 w-8 place-items-center rounded bg-[#2a2a2a] text-[#d7d7d7] transition hover:text-white disabled:cursor-not-allowed disabled:text-[#666]"
                    >
                        <Plus size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={resetView}
                        title="Reset zoom"
                        aria-label="Reset zoom"
                        className="grid h-8 w-8 place-items-center rounded bg-[#2a2a2a] text-[#d7d7d7] transition hover:text-white"
                    >
                        <RotateCcw size={15} />
                    </button>
                </div>
            ) : null}
            <div className="absolute inset-0" style={mapLayerStyle}>
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
            </div>
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
                    stroke: var(--generated-map-region-stroke-color) !important;
                    stroke-opacity: 0.72 !important;
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
                    width: clamp(10px, 1.05vw, 16px);
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

                .generated-map-marker[data-captured="false"] {
                    opacity: 0.68;
                }

                .generated-map-marker[data-captured="false"] .generated-map-marker-shell {
                    border-color: rgba(150, 150, 150, 0.48);
                    background: rgba(20, 20, 20, 0.62);
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
