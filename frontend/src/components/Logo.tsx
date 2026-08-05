export function Logo({ size = 20 }: { size?: number }) {
    return (
        <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="MapCode"
            width={size}
            height={size}
            className="object-contain"
        />
    );
}
