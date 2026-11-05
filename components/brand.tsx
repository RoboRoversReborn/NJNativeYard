import Link from "next/link";

export function LeafMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M40.5 7.5C25.2 7.1 10.9 14.8 8.3 30.6c7.7 1.8 21.8-1.1 29.2-15.2 1.5-2.9 2.5-5.8 3-7.9Z"
        fill="currentColor"
      />
      <path
        d="M9.2 40.8c4.2-10.5 12.3-17.4 23.3-22.5M18.1 31.6c2.4.1 5.1.8 7.2 2.1M25.5 24.8c.2-2.4 1.2-4.8 2.8-6.8"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <circle cx="9.2" cy="40.8" r="2.1" fill="currentColor" />
    </svg>
  );
}

export function Brand({
  className = "",
  href = "/",
  light = false,
}: {
  className?: string;
  href?: string;
  light?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2.5 ${className}`}
      aria-label="NativeYard home"
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-full ${
          light ? "bg-[#d7f27a] text-[#163f2c]" : "bg-[#163f2c] text-[#d7f27a]"
        } transition-transform duration-300 group-hover:-rotate-6`}
      >
        <LeafMark className="h-5 w-5" />
      </span>
      <span
        className={`font-display text-[1.35rem] font-semibold tracking-[-0.03em] ${
          light ? "text-[#f7f4e9]" : "text-[#163f2c]"
        }`}
      >
        NativeYard
      </span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.12em] ${
          light
            ? "bg-[#d7f27a] text-[#163f2c]"
            : "bg-[#163f2c] text-[#d7f27a]"
        }`}
      >
        NJ
      </span>
    </Link>
  );
}
