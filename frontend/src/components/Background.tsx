/** Ambient animated background: dark base + slow drifting neon blobs. */
export function Background() {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0d0e0f]">
            <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_18%_8%,rgba(255,161,22,0.07),transparent_60%),radial-gradient(55%_50%_at_85%_15%,rgba(0,217,255,0.06),transparent_60%),radial-gradient(50%_60%_at_50%_100%,rgba(255,0,212,0.05),transparent_60%)]" />
            <div className="bg-blob absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-[#ff9100]/10 blur-3xl" />
            <div className="bg-blob absolute -right-20 top-6 h-[28rem] w-[28rem] rounded-full bg-[#00d9ff]/10 blur-3xl [animation-delay:-9s]" />
            <div className="bg-blob absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-[#ff00d4]/10 blur-3xl [animation-delay:-17s]" />
        </div>
    );
}
