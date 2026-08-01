/** Flat dark backdrop so transparent page shells still sit on a dark base. */
export function Background() {
    return <div className="fixed inset-0 -z-10 bg-[#0d0e0f]" />;
}
