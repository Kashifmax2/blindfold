import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const PlayIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.1-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
  </svg>
);

export const PauseIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <rect x="6" y="4.5" width="4.2" height="15" rx="1.4" />
    <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" />
  </svg>
);

export const NextIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M6 5.3v13.4a1 1 0 0 0 1.53.85l10-6.7a1 1 0 0 0 0-1.7l-10-6.7A1 1 0 0 0 6 5.3Z" />
    <rect x="17.4" y="4.6" width="2.6" height="14.8" rx="1.3" />
  </svg>
);

export const PrevIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M18 5.3v13.4a1 1 0 0 1-1.53.85l-10-6.7a1 1 0 0 1 0-1.7l10-6.7A1 1 0 0 1 18 5.3Z" />
    <rect x="4" y="4.6" width="2.6" height="14.8" rx="1.3" />
  </svg>
);

export const ShuffleIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3 17h3.5l3-4.5M21 7h-4l-9 10H3M21 17h-4l-2.4-3.3M14.8 9.9 17 7" />
    <path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5 21 17l-2.5 2.5" />
  </svg>
);

export const RepeatIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M17 2.5 20.5 6 17 9.5" />
    <path d="M3.5 12V9a3 3 0 0 1 3-3h14" />
    <path d="M7 21.5 3.5 18 7 14.5" />
    <path d="M20.5 12v3a3 3 0 0 1-3 3h-14" />
  </svg>
);

export const VolumeIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M11 5 6.5 8.5H3.5v7h3L11 19z" fill="currentColor" stroke="none" />
    <path d="M15.2 9.3a4 4 0 0 1 0 5.4M18 6.6a8 8 0 0 1 0 10.8" />
  </svg>
);

export const MuteIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M11 5 6.5 8.5H3.5v7h3L11 19z" fill="currentColor" stroke="none" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const UploadIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15" />
  </svg>
);

export const TrashIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 7h16M10 4h4M6 7l.8 12A2 2 0 0 0 8.8 21h6.4a2 2 0 0 0 2-1.9L18 7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const StarIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m12 3.6 2.6 5.3 5.9.86-4.26 4.15 1 5.87L12 17l-5.24 2.76 1-5.87L3.5 9.76l5.9-.86z" />
  </svg>
);

export const BoltIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M13.5 2.5 4.8 13.2a.6.6 0 0 0 .47.98h5.03l-.8 7.32 8.7-10.7a.6.6 0 0 0-.47-.98h-5.03z" />
  </svg>
);

export const WaveIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3 12h2.2M8 5.5v13M12 3v18M16 7.5v9M20.8 12H19" />
  </svg>
);

export const ShieldIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 2.8 20 6v6.2c0 4.5-3.3 7.7-8 9.2-4.7-1.5-8-4.7-8-9.2V6z" />
    <path d="m9 12 2.2 2.2L15.4 10" />
  </svg>
);

export const MenuIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const ArrowIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
