export function Logo({ className = "" }: { className?: string }) {
    return (
        <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="MapCode"
            className={`h-full w-full object-contain ${className}`}
        />
    );
}
