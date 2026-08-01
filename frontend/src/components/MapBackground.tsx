const MAP_BG = `url(${import.meta.env.BASE_URL}map-bg.png)`;

/** Ambient blurred map backdrop with gradient overlays so content stays readable. */
export function MapBackground() {
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10"
            style={{
                backgroundImage: [
                    'linear-gradient(180deg, rgba(13,14,15,0.55) 0%, rgba(13,14,15,0.32) 35%, rgba(13,14,15,0.72) 72%, rgba(13,14,15,0.94) 100%)',
                    'radial-gradient(120% 85% at 50% 42%, transparent 45%, rgba(13,14,15,0.5) 100%)',
                    MAP_BG,
                ].join(', '),
                backgroundSize: 'cover, cover, cover',
                backgroundPosition: 'center, center, center',
                filter: 'blur(4px) brightness(0.72) saturate(0.85)',
            }}
        />
    );
}
