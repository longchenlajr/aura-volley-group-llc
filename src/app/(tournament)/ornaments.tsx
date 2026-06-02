interface SvgProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Monogram({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Top decorative line */}
      <line x1="8" y1="8" x2="40" y2="8" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      {/* L */}
      <path d="M12 14v20h10" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* V */}
      <path d="M26 14l6 20 6-20" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Bottom decorative line */}
      <line x1="8" y1="40" x2="40" y2="40" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
    </svg>
  );
}

interface CornerFlourishProps extends SvgProps {
  rotate?: number;
}

export function CornerFlourish({ className, style, rotate = 0 }: CornerFlourishProps) {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      className={className}
      style={{ ...style, transform: `rotate(${rotate}deg)` }}
      aria-hidden="true"
    >
      {/* L-shape corner */}
      <path d="M4 76V4h72" stroke="currentColor" strokeWidth="0.5" fill="none" />
      {/* Diamond at corner */}
      <path d="M4 4l4-2 -4-2 -4 2z" transform="translate(0, 4)" fill="currentColor" opacity="0.6" />
      {/* Inner line */}
      <path d="M10 70V10h60" stroke="currentColor" strokeWidth="0.3" fill="none" opacity="0.4" />
    </svg>
  );
}

export function Blossom({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* 5 petals as ellipses rotated around center */}
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="12"
          cy="6"
          rx="2.5"
          ry="5"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function DividerOrnament({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 120 12"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Left line */}
      <line x1="0" y1="6" x2="50" y2="6" stroke="currentColor" strokeWidth="0.5" />
      {/* Center diamond */}
      <path d="M60 1l5 5-5 5-5-5z" stroke="currentColor" strokeWidth="0.75" fill="none" />
      {/* Right line */}
      <line x1="70" y1="6" x2="120" y2="6" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  );
}

export function Checkmark({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 24l6 6 12-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRight({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M4 10h12m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronDown({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* --- NEW ORNAMENTS --- */

export function CloudMotif({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 60 32"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Traditional Asian stylized cloud — two connected spirals */}
      <path
        d="M8 24C8 24 4 20 8 16s8 0 12-4 0-8 4-8 4 4 8 4 4-4 8-4 8 4 4 8-4 4-8 8 4 4 8 4"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 20c2-2 6-2 8 0"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
    </svg>
  );
}

export function SectionDivider({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 320 20"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Left tapered line */}
      <line x1="0" y1="10" x2="110" y2="10" stroke="currentColor" strokeWidth="0.5" />
      {/* Left diamond */}
      <path d="M118 10l4-3 4 3-4 3z" stroke="currentColor" strokeWidth="0.6" fill="none" />
      {/* Center blossom */}
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="160"
          cy="10"
          rx="1.8"
          ry="4"
          stroke="currentColor"
          strokeWidth="0.6"
          fill="none"
          transform={`rotate(${angle} 160 10)`}
        />
      ))}
      <circle cx="160" cy="10" r="1" fill="currentColor" opacity="0.4" />
      {/* Right diamond */}
      <path d="M194 10l4-3 4 3-4 3z" stroke="currentColor" strokeWidth="0.6" fill="none" />
      {/* Right tapered line */}
      <line x1="210" y1="10" x2="320" y2="10" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  );
}

interface SeasonIconProps extends SvgProps {
  variant: "spring" | "summer" | "fall";
}

export function SeasonIcon({ variant, className, style }: SeasonIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {variant === "spring" && (
        /* Blossom sprig */
        <>
          <path d="M10 16V8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <circle cx="10" cy="5" r="3" stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
          <circle cx="13" cy="7" r="2.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
          <circle cx="10" cy="5" r="1" fill="currentColor" opacity="0.4" />
        </>
      )}
      {variant === "summer" && (
        /* Sun with rays */
        <>
          <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1" fill="none" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 10 + Math.cos(rad) * 5;
            const y1 = 10 + Math.sin(rad) * 5;
            const x2 = 10 + Math.cos(rad) * 7.5;
            const y2 = 10 + Math.sin(rad) * 7.5;
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
            );
          })}
        </>
      )}
      {variant === "fall" && (
        /* Maple leaf */
        <>
          <path d="M10 18V6" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
          <path
            d="M10 4C10 4 6 6 5 9c1-1 2.5-1 3 0-1.5 0-3 1-3 3 1.5-1 3-0.5 3.5 0.5C8 13 7 14 7 15c1.5-1 2.5-1.5 3-1 0.5 0.5 1.5 1 3 1 0-1-1-2-1.5-2.5 0.5-1 2-1.5 3.5-0.5 0-2-1.5-3-3-3 0.5-1 2-1 3 0-1-3-5-5-5-5z"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      )}
    </svg>
  );
}

export function LaurelWreath({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Left branch */}
      <path
        d="M7 20c0-3 1-5 2-7M5 17c1-2 3-3 4-3M4 14c1-1.5 3-2 4-1.5M4 11c1-1 3-1 4 0M5 8c1-0.5 2.5 0 3.5 1M7 5.5c0.8 0 2 0.5 2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right branch */}
      <path
        d="M17 20c0-3-1-5-2-7M19 17c-1-2-3-3-4-3M20 14c-1-1.5-3-2-4-1.5M20 11c-1-1-3-1-4 0M19 8c-1-0.5-2.5 0-3.5 1M17 5.5c-0.8 0-2 0.5-2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Star at crown */}
      <path
        d="M12 2l1 2.5h2.5l-2 1.5.8 2.5L12 7l-2.3 1.5.8-2.5-2-1.5H11z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

export function CalendarIcon({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 8h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 2v4M14 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="13" r="1" fill="currentColor" />
      <circle cx="10" cy="13" r="1" fill="currentColor" />
      <circle cx="13" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

export function GoldDotSpinner({ className, style }: SvgProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i * 45 * Math.PI) / 180;
        const cx = 10 + Math.cos(angle) * 7;
        const cy = 10 + Math.sin(angle) * 7;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="1.2"
            fill="currentColor"
            opacity="0.2"
          >
            <animate
              attributeName="opacity"
              values="0.2;1;0.2"
              dur="0.8s"
              begin={`${i * 0.1}s`}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}
    </svg>
  );
}
