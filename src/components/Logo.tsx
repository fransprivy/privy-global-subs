import Link from "next/link";

/** Approximation of the Privy heart logomark + wordmark (real assets to be swapped in production). */
export function PrivyMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 28.5c-.9 0-1.7-.3-2.4-.9L5.3 20C2.5 17.4 1.5 13.7 2.9 10.4 4.1 7.5 6.9 5.6 10 5.6c2.3 0 4.4 1 5.9 2.7 1.5-1.7 3.6-2.7 5.9-2.7 3.2 0 6 1.9 7.2 4.8 1.4 3.3.4 7-2.4 9.6l-8.3 7.6c-.6.6-1.4.9-2.3.9z"
        fill="#EC1C25"
      />
      <path d="M11.5 9.5c-2.3 0-4.4 1.3-5.3 3.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".85" />
    </svg>
  );
}

export function PrivyLogo({ href = "/home", size = 28 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="flex items-center gap-1.5" aria-label="Privy home">
      <PrivyMark size={size} />
      <span className="font-display text-[22px] font-semibold tracking-tight text-logo" style={{ lineHeight: 1 }}>
        privy
      </span>
    </Link>
  );
}

/** Heart avatar used in the screenshots. */
export function HeartAvatar({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[#ececec]"
      style={{ width: size, height: size }}
      aria-label="Profile"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M16 28.5c-.9 0-1.7-.3-2.4-.9L5.3 20C2.5 17.4 1.5 13.7 2.9 10.4 4.1 7.5 6.9 5.6 10 5.6c2.3 0 4.4 1 5.9 2.7 1.5-1.7 3.6-2.7 5.9-2.7 3.2 0 6 1.9 7.2 4.8 1.4 3.3.4 7-2.4 9.6l-8.3 7.6c-.6.6-1.4.9-2.3.9z"
          fill="#FF1D25"
        />
      </svg>
    </span>
  );
}
