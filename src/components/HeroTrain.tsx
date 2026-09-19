/** Decorative trainset behind the hero copy; `currentColor` throughout, so it follows the theme. */
export default function HeroTrain() {
  return (
    <svg
      className="hero__art"
      viewBox="0 0 1200 320"
      fill="none"
      preserveAspectRatio="xMinYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Falls away fast: a wide wash lands on the stats line and greys it out. */}
        <radialGradient id="hero-lamp-glow">
          <stop offset="0%" stopColor="#fff3d4" stopOpacity="0.72" />
          <stop offset="18%" stopColor="#ffc978" stopOpacity="0.24" />
          <stop offset="48%" stopColor="#ff9d3c" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#ff9d3c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g
        className="hero__art-body"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Body: roof running off the right edge, nose dropping away at the left. */}
        <path d="M1200 58 L260 58 C168 58 92 94 56 144 C36 172 30 206 38 226 C41 233 48 236 58 236 L1200 236 Z" />

        {/* Cab screen, raked back over the nose. */}
        <path d="M250 76 L250 148 L92 148 C104 124 134 96 172 82 C196 73 226 72 250 76 Z" fill="currentColor" fillOpacity="0.18" />

        {/* Continuous glazing, broken by the door bays. */}
        <g fill="currentColor" fillOpacity="0.18">
          <rect x="296" y="86" width="188" height="46" rx="14" />
          <rect x="506" y="86" width="188" height="46" rx="14" />
          <rect x="716" y="86" width="188" height="46" rx="14" />
          <rect x="926" y="86" width="188" height="46" rx="14" />
          <rect x="1136" y="86" width="64" height="46" rx="14" />
        </g>

        {/* Door bays. */}
        <g strokeWidth="4">
          <path d="M494 86 L494 198" />
          <path d="M704 86 L704 198" />
          <path d="M914 86 L914 198" />
          <path d="M1124 86 L1124 198" />
        </g>

        {/* Livery band along the lower body. */}
        <path d="M112 202 L1200 202" strokeWidth="14" strokeOpacity="0.45" />

        {/* Pantograph. */}
        <path d="M596 58 L616 26 L672 26" strokeWidth="4" />
        <path d="M652 26 L636 58" strokeWidth="4" />

        {/* Bogies. */}
        <g>
          <circle cx="190" cy="252" r="22" />
          <circle cx="300" cy="252" r="22" />
          <circle cx="650" cy="252" r="22" />
          <circle cx="760" cy="252" r="22" />
          <circle cx="1090" cy="252" r="22" />
          <circle cx="1200" cy="252" r="22" />
        </g>

        {/* Headlamp housing - the lamp itself is lit separately below. */}
        <circle cx="78" cy="196" r="11" fill="currentColor" fillOpacity="0.3" strokeWidth="4" />

        {/* Rail. */}
        <path d="M0 282 L1200 282" strokeWidth="5" strokeOpacity="0.5" />
      </g>

      {/* Switched on after dark, offset forward so the throw falls towards the nose. */}
      <g className="hero__art-lamp">
        <circle cx="66" cy="196" r="70" fill="url(#hero-lamp-glow)" />
        <circle cx="78" cy="196" r="13" fill="#fff6e0" />
        <circle cx="78" cy="196" r="7" fill="#ffffff" />
      </g>
    </svg>
  );
}
