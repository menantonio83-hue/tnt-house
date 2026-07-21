// Version 1.0 — app/risk-api/InsiderClusterGraph.tsx
//
// Illustrates the actual insider_clusters feature (wallets sharing a
// first-funder) instead of a generic crypto banner — a central "funder"
// node with lines to several connected wallets, plus one deliberately
// unconnected wallet off to the side to visually contrast "flagged" vs
// "ordinary." Pure inline SVG + native SVG <animate> for the flowing-
// line effect (no image assets, no animation library, no Canva) — same
// purple→emerald palette as the rest of the site.

export default function InsiderClusterGraph() {
  return (
    <svg
      viewBox="0 0 400 200"
      className="w-full h-auto max-w-md mx-auto"
      role="img"
      aria-label="Diagram: several wallets sharing one first-funder, flagged as an insider cluster; one separate wallet with no shared funder is unflagged"
    >
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <radialGradient id="funderGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Funder glow */}
      <circle cx="90" cy="105" r="34" fill="url(#funderGlow)" />

      {/* Lines: funder -> each clustered wallet, with a subtle flowing-dash animation */}
      {[
        [90, 105, 270, 34],
        [90, 105, 300, 90],
        [90, 105, 278, 150],
        [90, 105, 235, 188],
      ].map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="url(#lineGradient)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.8"
        >
          <animate attributeName="stroke-dashoffset" from="14" to="0" dur="1.2s" repeatCount="indefinite" />
        </line>
      ))}

      {/* Funder node */}
      <circle cx="90" cy="105" r="7" fill="#a855f7" />
      <text x="90" y="128" textAnchor="middle" className="fill-purple-300" fontSize="9" fontFamily="monospace">
        first funder
      </text>

      {/* Clustered wallet nodes */}
      {[
        [270, 34],
        [300, 90],
        [278, 150],
        [235, 188],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill="#34d399" />
      ))}
      <text x="288" y="15" textAnchor="middle" className="fill-emerald-300" fontSize="9" fontFamily="monospace">
        insider cluster
      </text>

      {/* One deliberately unconnected wallet — contrast case */}
      <circle cx="365" cy="105" r="5" fill="#64748b" />
      <text x="365" y="128" textAnchor="middle" className="fill-slate-500" fontSize="8" fontFamily="monospace">
        no shared funder
      </text>
    </svg>
  );
}
