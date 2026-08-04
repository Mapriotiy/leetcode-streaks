import { useRef, useEffect } from 'react';
import { mapSvgString } from '../mapSvgString';

const SVGNS = 'http://www.w3.org/2000/svg';
const R = 4;

const COLORS: Record<string, string> = {
    player: '#00e5ff',
    enemy: '#ff2d55',
};

type Marker = {
    g: SVGGElement;
    ring: SVGCircleElement;
    icon: SVGGElement;
};

type ProvinceMapProps = {
    captured: Map<string, string>;
    onSelect: (id: string, pos: { x: number; y: number }) => void;
    highlightedProvinces: string[] | null;
    bursts?: Map<string, string>;
    fortified?: Set<string>;
};

function parseScale(transform: string | null): number {
    if (!transform) return 1;
    const m = transform.match(/scale\(\s*([\d.e+-]+)\s*\)/);
    return m ? parseFloat(m[1]) : 1;
}

function createMarkerGroup(cx: number, cy: number): {
    g: SVGGElement;
    ring: SVGCircleElement;
    icon: SVGGElement;
} {
    const g = document.createElementNS(SVGNS, 'g') as SVGGElement;
    g.setAttribute('transform', `translate(${cx},${cy})`);
    g.style.pointerEvents = 'none';

    const shadow = document.createElementNS(SVGNS, 'circle') as SVGCircleElement;
    shadow.setAttribute('r', String(R));
    shadow.setAttribute('fill', 'rgba(0,0,0,0.3)');
    shadow.setAttribute('cy', '0.6');
    g.appendChild(shadow);

    const ring = document.createElementNS(SVGNS, 'circle') as SVGCircleElement;
    ring.setAttribute('r', String(R));
    ring.setAttribute('fill', 'rgba(20,20,20,0.85)');
    ring.setAttribute('stroke', '#777');
    ring.setAttribute('stroke-width', '0.5');
    g.appendChild(ring);

    const icon = document.createElementNS(SVGNS, 'g') as SVGGElement;
    g.appendChild(icon);

    const dot = document.createElementNS(SVGNS, 'circle') as SVGCircleElement;
    dot.setAttribute('r', String(R * 0.22));
    dot.setAttribute('fill', '#777');
    icon.appendChild(dot);

    return { g, ring, icon };
}

function setIconDot(icon: SVGGElement) {
    icon.innerHTML = '';
    const dot = document.createElementNS(SVGNS, 'circle') as SVGCircleElement;
    dot.setAttribute('r', String(R * 0.22));
    dot.setAttribute('fill', '#777');
    icon.appendChild(dot);
}

function setIconFlag(icon: SVGGElement, color: string) {
    icon.innerHTML = '';
    const pole = document.createElementNS(SVGNS, 'path') as SVGPathElement;
    pole.setAttribute('d', 'M-0.8,-2.5 L-0.8,2.5');
    pole.setAttribute('stroke', color);
    pole.setAttribute('stroke-width', '0.6');
    pole.setAttribute('stroke-linecap', 'round');
    icon.appendChild(pole);
    const flag = document.createElementNS(SVGNS, 'path') as SVGPathElement;
    flag.setAttribute('d', 'M-0.8,-2.5 L2.2,-1.5 L-0.8,-0.5 Z');
    flag.setAttribute('fill', color);
    icon.appendChild(flag);
}

function applyCaptured(path: SVGPathElement, color: string) {
    path.style.opacity = '0.38';
    path.style.stroke = color;
    path.style.strokeWidth = '5';
    path.style.fill = color + '66';
    path.style.filter = `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 12px ${color})`;
}

function resolveCaptureColor(owner: string | undefined): string | null {
    if (!owner) return null;
    return COLORS[owner] ?? owner;
}

export default function ProvinceMap({ captured, onSelect, highlightedProvinces, bursts, fortified }: ProvinceMapProps) {
    const svgWrapRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<Map<string, Marker>>(new Map());
    const pathStylesRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        const el = svgWrapRef.current;
        if (!el || el.querySelector('svg')) return;

        try {
            el.innerHTML = mapSvgString;
        } catch (err) {
            console.error('[ProvinceMap] innerHTML failed:', err);
            return;
        }
        const svg = el.querySelector('svg');
        if (!svg) {
            console.error('[ProvinceMap] No SVG element found after injection');
            return;
        }

        svg.setAttribute('preserveAspectRatio', 'none');

        svg.querySelectorAll<SVGPathElement>('.prov').forEach((path) => {
            if (markersRef.current.has(path.id)) return;

            pathStylesRef.current.set(path.id, path.getAttribute('style') || '');

            let cx = 0, cy = 0;
            try {
                const pathBbox = path.getBBox();
                const s = parseScale(path.getAttribute('transform'));
                cx = (pathBbox.x + pathBbox.width / 2) * s;
                cy = (pathBbox.y + pathBbox.height / 2) * s;
            } catch (err) {
                console.error('[ProvinceMap] getBBox failed for', path.id, err);
                return;
            }

            const { g, ring, icon } = createMarkerGroup(cx, cy);
            path.parentNode?.insertBefore(g, path.nextSibling);
            markersRef.current.set(path.id, { g, ring, icon });
        });

        svg.addEventListener('click', (e: Event) => {
            const target = e.target as Element;
            const path = target.closest<SVGPathElement>('.prov');
            if (!path) return;
            const marker = markersRef.current.get(path.id);
            if (!marker) return;

            const rect = marker.g.getBoundingClientRect();
            onSelect(path.id, {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            });
        });
    }, []);

    useEffect(() => {
        const svg = svgWrapRef.current?.querySelector('svg');
        if (!svg) return;

        svg.querySelectorAll<SVGPathElement>('.prov').forEach((path) => {
            const marker = markersRef.current.get(path.id);
            const owner = captured.get(path.id);
            const color = resolveCaptureColor(owner);

            if (color) {
                applyCaptured(path, color);
                if (marker) {
                    marker.ring.setAttribute('stroke', color);
                    marker.ring.setAttribute('stroke-width', '1');
                    setIconFlag(marker.icon, color);
                }
            } else {
                path.setAttribute('style', pathStylesRef.current.get(path.id) || '');
                if (marker) {
                    marker.ring.setAttribute('stroke', '#777');
                    marker.ring.setAttribute('stroke-width', '0.5');
                    setIconDot(marker.icon);
                }
            }
        });
    }, [captured]);

    useEffect(() => {
        const svg = svgWrapRef.current?.querySelector('svg');
        if (!svg) return;

        bursts?.forEach((color, id) => {
            const marker = markersRef.current.get(id);
            if (!marker) return;
            const ring = document.createElementNS(SVGNS, 'circle');
            ring.setAttribute('r', String(R));
            ring.setAttribute('fill', 'none');
            ring.setAttribute('stroke', color);
            ring.setAttribute('stroke-width', '2.5');
            ring.classList.add('capture-burst');
            marker.g.appendChild(ring);
            ring.addEventListener('animationend', () => ring.remove(), { once: true });
        });
    }, [bursts]);

    useEffect(() => {
        const svg = svgWrapRef.current?.querySelector('svg');
        if (!svg) return;

        svg.querySelectorAll<SVGPathElement>('.prov').forEach((path) => {
            const marker = markersRef.current.get(path.id);
            if (!marker) return;
            const isFortified = fortified?.has(path.id) ?? false;
            const existing = marker.g.querySelector('.fortify-shield');
            if (isFortified && !existing) {
                const shield = document.createElementNS(SVGNS, 'path');
                shield.setAttribute(
                    'd',
                    'M0 -12 L3.2 -10.5 L3.2 -6.8 C3.2 -4.2 1.7 -2.6 0 -1.6 C-1.7 -2.6 -3.2 -4.2 -3.2 -6.8 L-3.2 -10.5 Z',
                );
                shield.setAttribute('fill', '#ffa116');
                shield.setAttribute('stroke', '#3a2a08');
                shield.setAttribute('stroke-width', '0.3');
                shield.classList.add('fortify-shield');
                marker.g.appendChild(shield);
            } else if (!isFortified && existing) {
                existing.remove();
            }
        });
    }, [fortified]);

    useEffect(() => {
        const svg = svgWrapRef.current?.querySelector('svg');
        if (!svg) return;

        svg.querySelectorAll<SVGPathElement>('.prov').forEach((path) => {
            const owner = captured.get(path.id);
            const color = resolveCaptureColor(owner);
            const isCaptured = Boolean(color);

            if (!highlightedProvinces) {
                if (isCaptured && color) {
                    applyCaptured(path, color);
                } else {
                    path.setAttribute('style', pathStylesRef.current.get(path.id) || '');
                }
                return;
            }

            const isHighlighted = highlightedProvinces.includes(path.id);

            if (isHighlighted) {
                if (isCaptured && color) {
                    applyCaptured(path, color);
                } else {
                    path.setAttribute('style', pathStylesRef.current.get(path.id) || '');
                    path.style.opacity = '0.45';
                    path.style.filter = 'drop-shadow(0 0 5px rgba(255,255,255,0.4))';
                }
            } else {
                if (isCaptured && color) {
                    applyCaptured(path, color);
                    path.style.opacity = '0.15';
                } else {
                    path.setAttribute('style', pathStylesRef.current.get(path.id) || '');
                    path.style.opacity = '0.03';
                }
            }
        });
    }, [highlightedProvinces, captured]);

    return (
        <div
            className="relative w-full overflow-hidden rounded-2xl shadow-2xl border border-white/10"
            style={{ aspectRatio: '1321 / 900' }}
        >
            <img
                src={`${import.meta.env.BASE_URL}leet_background.webp`}
                alt="Background"
                className="absolute inset-0 w-full h-full object-fill"
                decoding="async"
                onError={(e) => console.error('[ProvinceMap] Background image failed:', (e.target as HTMLImageElement).src)}
            />
            <div ref={svgWrapRef} className="absolute inset-0 w-full h-full" />
        </div>
    );
}
