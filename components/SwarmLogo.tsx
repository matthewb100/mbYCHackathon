"use client";

/**
 * Swarm logo: cluster of nodes suggesting coordinated agents.
 * Use size="sm" | "md" | "lg" for different contexts.
 */
export function SwarmLogo({
  size = "md",
  showWordmark = true,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}) {
  const sizes = { sm: { icon: 28, text: "text-lg" }, md: { icon: 40, text: "text-xl" }, lg: { icon: 56, text: "text-3xl" } };
  const { icon: iconSize, text } = sizes[size];

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="flex-shrink-0"
      >
        {/* Central node */}
        <circle cx="24" cy="24" r="8" fill="url(#swarm-center)" />
        {/* Orbiting nodes */}
        <circle cx="24" cy="8" r="4" fill="url(#swarm-orb)" opacity="0.9" />
        <circle cx="38" cy="18" r="4" fill="url(#swarm-orb)" opacity="0.85" />
        <circle cx="38" cy="34" r="4" fill="url(#swarm-orb)" opacity="0.85" />
        <circle cx="24" cy="42" r="4" fill="url(#swarm-orb)" opacity="0.9" />
        <circle cx="10" cy="34" r="4" fill="url(#swarm-orb)" opacity="0.85" />
        <circle cx="10" cy="18" r="4" fill="url(#swarm-orb)" opacity="0.85" />
        {/* Subtle connectors */}
        <path d="M24 12v4M32 20h-4M32 32h-4M24 38v-4M16 32h4M16 20h4" stroke="url(#swarm-line)" strokeWidth="1" strokeOpacity="0.4" fill="none" />
        <defs>
          <linearGradient id="swarm-center" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="swarm-orb" x1="0" y1="0" x2="8" y2="8" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22d3ee" />
            <stop offset="1" stopColor="#818cf8" />
          </linearGradient>
          <linearGradient id="swarm-line" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      </svg>
      {showWordmark && (
        <span className={`font-bold tracking-tight text-white ${text}`}>
          Swarm
        </span>
      )}
    </div>
  );
}
