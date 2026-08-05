import { useMemo, type CSSProperties } from "react";

/** Floating glowing particles drifting upward across the screen. */
export function EpicParticles({ color, count = 26 }: { color: string; count?: number }) {
    const particles = useMemo(
        () =>
            Array.from({ length: count }, (_, i) => ({
                left: (i * 37) % 100,
                size: 2 + (i % 4),
                delay: (i % 22) * 0.4,
                duration: 6 + (i % 5) * 1.4,
                drift: -34 + ((i * 23) % 69),
                opacity: 0.3 + ((i * 13) % 40) / 100,
            })),
        [count],
    );

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {particles.map((p, index) => (
                <span
                    key={index}
                    className="particle"
                    style={
                        {
                            left: `${p.left}%`,
                            width: p.size,
                            height: p.size,
                            backgroundColor: color,
                            opacity: p.opacity,
                            "--particle-dur": `${p.duration}s`,
                            "--particle-delay": `${p.delay}s`,
                            "--particle-drift": `${p.drift}px`,
                        } as CSSProperties
                    }
                />
            ))}
        </div>
    );
}

/** Pulsing vertical light beams hugging the left/right screen edges. */
export function SideBeams({ color }: { color: string }) {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="side-beam" style={{ left: 0, "--beam-color": color } as CSSProperties} />
            <div className="side-beam" style={{ right: 0, "--beam-color": color } as CSSProperties} />
        </div>
    );
}
