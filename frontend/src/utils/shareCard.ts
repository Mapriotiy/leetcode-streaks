import { mapSvgString } from "../mapSvgString";
import { mapAssetUrl } from "../features/lobby-map/assets";
import type { GeneratedMapDraft, GeneratedMapIsland } from "../features/lobby-map/types";

const LEET_MAP_BG = `${import.meta.env.BASE_URL}leet_background.webp`;
const imageCache = new Map<string, Promise<HTMLImageElement>>();
const svgTextCache = new Map<string, Promise<string>>();

export type ShareCardData = {
    title: string;
    name: string;
    accentColor: string;
    points: number;
    provinces: number;
    mapKind?: "default" | "generated";
    capturedColors?: Record<string, string>;
    mapBackground?: HTMLCanvasElement | HTMLImageElement | string;
    draft?: unknown;
};

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
    const cached = imageCache.get(src);
    if (cached) return cached;

    const promise = new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
        img.crossOrigin = "anonymous";
        img.src = src;
    });
    imageCache.set(src, promise);
    return promise;
}

function loadSvgText(src: string) {
    const cached = svgTextCache.get(src);
    if (cached) return cached;

    const promise = fetch(src).then((response) => (response.ok ? response.text() : ""));
    svgTextCache.set(src, promise);
    return promise;
}

function sourceSize(source: HTMLCanvasElement | HTMLImageElement) {
    if (source instanceof HTMLCanvasElement) {
        return { width: source.width, height: source.height };
    }
    return {
        width: source.naturalWidth || source.width,
        height: source.naturalHeight || source.height,
    };
}

function drawImageContain(
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement | HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    padding = 0,
) {
    const size = sourceSize(source);
    if (size.width <= 0 || size.height <= 0) return;

    const availableWidth = Math.max(1, width - padding * 2);
    const availableHeight = Math.max(1, height - padding * 2);
    const scale = Math.min(availableWidth / size.width, availableHeight / size.height);
    const drawWidth = size.width * scale;
    const drawHeight = size.height * scale;

    ctx.drawImage(
        source,
        x + (width - drawWidth) / 2,
        y + (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
    );
}

function drawImageCover(
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement | HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
) {
    const size = sourceSize(source);
    if (size.width <= 0 || size.height <= 0) return;

    const scale = Math.max(width / size.width, height / size.height);
    const drawWidth = size.width * scale;
    const drawHeight = size.height * scale;

    ctx.drawImage(
        source,
        x + (width - drawWidth) / 2,
        y + (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
    );
}

function buildColoredMapSvg(colors: Record<string, string>): string | null {
    try {
        const doc = new DOMParser().parseFromString(mapSvgString, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (!svg) return null;

        svg.setAttribute("width", "1321");
        svg.setAttribute("height", "900");
        svg.querySelectorAll("path.prov").forEach((path) => {
            const color = colors[path.id];
            if (!color) return;

            path.setAttribute("fill", color);
            path.setAttribute("fill-opacity", "0.48");
            path.setAttribute("stroke", color);
            path.setAttribute("stroke-opacity", "0.96");
            path.setAttribute("stroke-width", "3.2");
            path.setAttribute(
                "style",
                [
                    "opacity:0.58",
                    `fill:${color}`,
                    "fill-opacity:0.48",
                    `stroke:${color}`,
                    "stroke-opacity:0.96",
                    "stroke-width:3.2",
                    `filter:drop-shadow(0 0 4px ${color}) drop-shadow(0 0 10px ${color})`,
                ].join(";"),
            );
        });

        return new XMLSerializer().serializeToString(svg);
    } catch {
        return null;
    }
}

function drawEmptyGeneratedFallback(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const sea = ctx.createLinearGradient(0, 0, width, height);
    sea.addColorStop(0, "#15191b");
    sea.addColorStop(1, "#0b0c0d");
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, width, height);
}

function isGeneratedMapDraft(value: unknown): value is GeneratedMapDraft {
    if (!value || typeof value !== "object") return false;
    const draft = value as Partial<GeneratedMapDraft>;
    return Array.isArray(draft.islands) && Array.isArray(draft.provinces) && Array.isArray(draft.regions);
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

function getSvgAttr(tag: string, name: string) {
    const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "i"));
    return match?.[1] ?? match?.[2] ?? null;
}

function parseSvgViewBox(svgText: string) {
    const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] ?? "";
    const viewBox = getSvgAttr(svgTag, "viewBox");
    if (viewBox) {
        const values = viewBox.trim().split(/[\s,]+/).map(Number);
        if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
            return { x: values[0], y: values[1], width: values[2], height: values[3] };
        }
    }

    const svgWidth = Number(getSvgAttr(svgTag, "width"));
    const svgHeight = Number(getSvgAttr(svgTag, "height"));
    if (Number.isFinite(svgWidth) && Number.isFinite(svgHeight) && svgWidth > 0 && svgHeight > 0) {
        return { x: 0, y: 0, width: svgWidth, height: svgHeight };
    }

    return { x: 0, y: 0, width: 100, height: 100 };
}

function islandMaskPath(svgText: string, islandW: number, islandH: number) {
    const viewBox = parseSvgViewBox(svgText);
    const scaleX = islandW / viewBox.width;
    const scaleY = islandH / viewBox.height;
    const matrix = new DOMMatrix([
        scaleX,
        0,
        0,
        scaleY,
        -islandW / 2 - viewBox.x * scaleX,
        -islandH / 2 - viewBox.y * scaleY,
    ]);
    const mask = new Path2D();

    for (const match of svgText.matchAll(/<path\b[^>]*>/g)) {
        const d = getSvgAttr(match[0], "d");
        if (!d) continue;
        mask.addPath(new Path2D(d), matrix);
    }

    return mask;
}

function generatedIslandSvg({
    svgText,
    island,
    draft,
    capturedColors,
}: {
    svgText: string;
    island: GeneratedMapIsland;
    draft: GeneratedMapDraft;
    capturedColors: Record<string, string>;
}) {
    const provinceByPath = new Map(
        draft.provinces
            .filter((province) => province.islandId === island.islandId)
            .map((province) => [province.pathIndex, province]),
    );
    const regionById = new Map(draft.regions.map((region) => [region.regionId, region]));
    let pathIndex = 0;

    return svgText
        .replace(/<svg\b([^>]*)>/, '<svg$1 preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">')
        .replace(/<path\b[^>]*>/g, (tag) => {
            const province = provinceByPath.get(pathIndex);
            const provinceId = province?.provinceId ?? `${island.islandId}-${pathIndex}`;
            const region = province ? regionById.get(province.regionId) : null;
            const capturedColor = capturedColors[provinceId] ?? null;
            const regionColor = region?.color ?? "#8f7458";
            const fill = capturedColor ? mixHex(capturedColor, "#101112", 0.78) : mixHex(regionColor, "#242827", 0.68);
            const stroke = capturedColor ? mixHex(capturedColor, "#ffffff", 0.88) : mixHex(regionColor, "#303332", 0.82);
            pathIndex += 1;

            let nextTag = tag;
            nextTag = setSvgAttr(nextTag, "fill", fill);
            nextTag = setSvgAttr(nextTag, "fill-opacity", capturedColor ? "0.76" : "0.22");
            nextTag = setSvgAttr(nextTag, "opacity", capturedColor ? "1" : "0.58");
            nextTag = setSvgAttr(nextTag, "stroke", stroke);
            nextTag = setSvgAttr(nextTag, "stroke-opacity", capturedColor ? "1" : "0.64");
            nextTag = setSvgAttr(nextTag, "stroke-width", capturedColor ? "4.2" : "1.15");
            nextTag = setSvgAttr(nextTag, "stroke-linejoin", "round");
            nextTag = setSvgAttr(nextTag, "stroke-linecap", "round");
            return nextTag;
        });
}

function parseAspectRatio(value: string) {
    const parts = value.split("/").map((part) => Number(part.trim()));
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1321 / 900;
}

async function drawGeneratedMap(
    ctx: CanvasRenderingContext2D,
    draft: GeneratedMapDraft,
    capturedColors: Record<string, string>,
    x: number,
    y: number,
    width: number,
    height: number,
    fit: "contain" | "cover" = "contain",
) {
    const rootScale = fit === "cover"
        ? Math.max(width / 1321, height / 900)
        : Math.min(width / 1321, height / 900);
    const rootWidth = 1321 * rootScale;
    const rootHeight = 900 * rootScale;
    const rootX = x + (width - rootWidth) / 2;
    const rootY = y + (height - rootHeight) / 2;

    const sea = await loadImage(mapAssetUrl(draft.seaBaseSrc));
    drawImageCover(ctx, sea, x, y, width, height);

    for (const sprite of draft.seaSprites) {
        const img = await loadImage(mapAssetUrl(sprite.src));
        const imgSize = sourceSize(img);
        if (imgSize.width <= 0 || imgSize.height <= 0) continue;

        const spriteW = rootWidth * (sprite.width / 100);
        const spriteH = spriteW * (imgSize.height / imgSize.width);
        const spriteX = rootX + rootWidth * (sprite.left / 100);
        const spriteY = rootY + rootHeight * (sprite.top / 100);

        ctx.save();
        ctx.globalAlpha = sprite.opacity * 0.42;
        ctx.translate(spriteX + spriteW / 2, spriteY + spriteH / 2);
        ctx.rotate((sprite.rotation * Math.PI) / 180);
        ctx.drawImage(img, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
        ctx.restore();
    }

    const islands = [...draft.islands].sort((a, b) => a.zIndex - b.zIndex);
    for (const island of islands) {
        const islandW = rootWidth * (island.width / 100);
        const islandH = islandW / parseAspectRatio(island.aspectRatio);
        const islandX = rootX + rootWidth * (island.left / 100);
        const islandY = rootY + rootHeight * (island.top / 100);

        const [back, svgResponse] = await Promise.all([
            loadImage(mapAssetUrl(island.backPath)),
            loadSvgText(mapAssetUrl(island.svgPath)),
        ]);
        const rawSvg = svgResponse;
        const overlaySvg = rawSvg
            ? generatedIslandSvg({ svgText: rawSvg, island, draft, capturedColors })
            : null;
        const overlayUrl = overlaySvg
            ? URL.createObjectURL(new Blob([overlaySvg], { type: "image/svg+xml" }))
            : null;
        const overlay = overlayUrl ? await loadImage(overlayUrl) : null;

        ctx.save();
        ctx.translate(islandX + islandW / 2, islandY + islandH / 2);
        ctx.rotate((island.rotation * Math.PI) / 180);
        if (rawSvg) {
            ctx.save();
            ctx.clip(islandMaskPath(rawSvg, islandW, islandH));
            ctx.globalAlpha = 0.82;
            drawImageContain(ctx, back, -islandW / 2, -islandH / 2, islandW, islandH);
            ctx.restore();
        }
        if (overlay) {
            ctx.globalAlpha = 1;
            drawImageContain(ctx, overlay, -islandW / 2, -islandH / 2, islandW, islandH);
        }
        ctx.restore();

        if (overlayUrl) URL.revokeObjectURL(overlayUrl);
    }
}

export async function generateShareCard(data: ShareCardData): Promise<string> {
    const width = 1080;
    const height = 1350;
    const mapBandH = 1120;
    const mapY = 0;
    const mapH = mapBandH;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    const provinceCount = data.provinces || Object.keys(data.capturedColors ?? {}).length;

    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, width, height);

    const bgGradient = ctx.createRadialGradient(width / 2, 260, 0, width / 2, 260, 760);
    bgGradient.addColorStop(0, `${data.accentColor}22`);
    bgGradient.addColorStop(0.52, "rgba(20,20,20,0.72)");
    bgGradient.addColorStop(1, "#101010");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, mapBandH);
    ctx.clip();
    ctx.filter = "brightness(1.18) contrast(1.08) saturate(1.08)";

    if (data.mapKind === "generated" && isGeneratedMapDraft(data.draft)) {
        await drawGeneratedMap(ctx, data.draft, data.capturedColors ?? {}, -70, mapY, width + 140, mapH);
    } else if (data.mapBackground) {
        const src = data.mapBackground;
        const img = typeof src === "string" ? await loadImage(src) : src;
        drawImageCover(ctx, img, 0, mapY, width, mapH);
    } else if (
        data.mapKind === "default" &&
        data.capturedColors &&
        Object.keys(data.capturedColors).length > 0
    ) {
        const base = await loadImage(LEET_MAP_BG);
        drawImageCover(ctx, base, 0, mapY, width, mapH);

        const svgText = buildColoredMapSvg(data.capturedColors);
        if (svgText) {
            const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
            const overlay = await loadImage(url);
            drawImageCover(ctx, overlay, 0, mapY, width, mapH);
            URL.revokeObjectURL(url);
        }
    } else {
        drawEmptyGeneratedFallback(ctx, width, mapBandH);
    }

    ctx.restore();
    ctx.filter = "none";

    const bandGrade = ctx.createLinearGradient(0, 0, 0, mapBandH);
    bandGrade.addColorStop(0, "rgba(8,9,10,0.14)");
    bandGrade.addColorStop(0.34, "rgba(8,9,10,0.12)");
    bandGrade.addColorStop(0.58, "rgba(8,9,10,0.34)");
    bandGrade.addColorStop(0.78, "rgba(10,10,11,0.78)");
    bandGrade.addColorStop(1, "rgba(16,16,16,0.98)");
    ctx.fillStyle = bandGrade;
    ctx.fillRect(0, 0, width, mapBandH);

    const glow = ctx.createRadialGradient(width / 2, 760, 0, width / 2, 760, 440);
    glow.addColorStop(0, `${data.accentColor}42`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffa116";
    ctx.font = "800 38px system-ui, sans-serif";
    ctx.fillText("MapCode", width / 2, 92);

    ctx.fillStyle = "rgba(255,255,255,0.36)";
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillText("LeetCode territory battle", width / 2, 132);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 108px system-ui, sans-serif";
    ctx.fillText(data.title, width / 2, 690);

    ctx.fillStyle = data.accentColor;
    ctx.font = "700 58px system-ui, sans-serif";
    ctx.fillText(data.name, width / 2, 772);

    const panelY = 865;
    const panelW = 790;
    const panelX = (width - panelW) / 2;
    roundRect(ctx, panelX, panelY, panelW, 245, 30);
    ctx.fillStyle = "rgba(22,23,25,0.96)";
    ctx.fill();
    ctx.strokeStyle = `${data.accentColor}77`;
    ctx.lineWidth = 4;
    ctx.stroke();

    const stats = [
        { label: "Provinces", value: String(provinceCount), color: "#7fe8ff" },
        { label: "Points", value: String(data.points), color: "#ffa116" },
    ];
    const cellW = panelW / stats.length;
    stats.forEach((stat, index) => {
        const cx = panelX + cellW * index + cellW / 2;
        ctx.fillStyle = "#8a8a8a";
        ctx.font = "600 28px system-ui, sans-serif";
        ctx.fillText(stat.label.toUpperCase(), cx, panelY + 76);
        ctx.fillStyle = stat.color;
        ctx.font = "900 86px system-ui, sans-serif";
        ctx.fillText(stat.value, cx, panelY + 182);
    });

    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.font = "500 30px system-ui, sans-serif";
    ctx.fillText("solve - capture - keep the streak", width / 2, height - 72);

    return canvas.toDataURL("image/png");
}
