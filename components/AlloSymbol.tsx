/**
 * AlloSymbol — the Allo branching/neural icon reproduced as an inline SVG.
 * Matches the organic, synapse-like mark used in the Allo brand identity.
 */
export function AlloSymbol({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* ── Branch 1: upper-right, forks into two prongs ── */}
      <path d="M11.5 13 Q14 10 16.5 7" />
      <path d="M16.5 7 Q18 5.2 20.2 3.8" />
      <path d="M16.5 7 Q18.5 6.8 21 7.5" />

      {/* ── Branch 2: right, forks up and down ── */}
      <path d="M11.5 13 Q14.5 13 17.5 13.5" />
      <path d="M17.5 13.5 Q19.8 11.8 21.5 10.5" />
      <path d="M17.5 13.5 Q19.5 15 21 16.5" />

      {/* ── Branch 3: lower, forks left and right ── */}
      <path d="M11.5 13 Q12.5 16 13.5 19.5" />
      <path d="M13.5 19.5 Q12 21.5 10.5 23" />
      <path d="M13.5 19.5 Q15 21 16.5 22.5" />

      {/* ── Branch 4: upper-left, forks up-left and left ── */}
      <path d="M11.5 13 Q9 11 6.5 8.5" />
      <path d="M6.5 8.5 Q4.8 6.5 3 4.5" />
      <path d="M6.5 8.5 Q5.2 10.5 4.5 12.5" />
    </svg>
  );
}
