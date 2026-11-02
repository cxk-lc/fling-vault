interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconGrid = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2" y="2" width="5" height="5" />
    <rect x="9" y="2" width="5" height="5" />
    <rect x="2" y="9" width="5" height="5" />
    <rect x="9" y="9" width="5" height="5" />
  </svg>
);

export const IconDownloaded = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8 2v8" />
    <path d="M4.5 7L8 10.5 11.5 7" />
    <path d="M2.5 13.5h11" />
  </svg>
);

export const IconArrowUpCircle = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 11V5" />
    <path d="M5.4 7.6L8 5l2.6 2.6" />
  </svg>
);

export const IconStar = ({ size = 14, className, filled }: IconProps & { filled?: boolean }) => (
  <svg {...base(size)} className={className} fill={filled ? 'currentColor' : 'none'}>
    <path d="M8 2.2l1.72 3.5 3.86.56-2.79 2.72.66 3.84L8 11.02l-3.45 1.8.66-3.84L2.42 6.26l3.86-.56z" />
  </svg>
);

export const IconRefresh = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M13.2 7.2a5.2 5.2 0 1 0-.5 3.1" />
    <path d="M13.4 2.6v4.6h-4.6" />
  </svg>
);

export const IconSearch = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="7" cy="7" r="4.4" />
    <path d="M10.3 10.3L13.6 13.6" />
  </svg>
);

export const IconPlay = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M4.6 2.6l8.2 5.4-8.2 5.4z" />
  </svg>
);

export const IconFolder = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M2 4.2h4l1.3 1.6h6.7v6.4H2z" />
    <path d="M2 4.2V3.2h4.2" />
  </svg>
);

export const IconTrash = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M2.6 4.4h10.8" />
    <path d="M6.2 4.4V2.8h3.6v1.6" />
    <path d="M3.8 4.4l.7 9h7l.7-9" />
    <path d="M6.6 6.8v4.2M9.4 6.8v4.2" />
  </svg>
);

export const IconSettings = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.8v1.6M8 12.6v1.6M2.4 8H4M12 8h1.6M3.9 3.9l1.1 1.1M11 11l1.1 1.1M12.1 3.9L11 5M5 11l-1.1 1.1" />
  </svg>
);

export const IconTag = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M2.4 2.4h5.2L13.4 8l-5.4 5.4L2.4 7.6z" />
    <circle cx="5.2" cy="5.2" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconClose = ({ size = 12, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2" />
  </svg>
);

export const IconExternal = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9.2 2.6h4.2v4.2" />
    <path d="M13.4 2.6L7.6 8.4" />
    <path d="M11.6 9.4v3.2H3.2V4.4h3.2" />
  </svg>
);

export const IconChevron = ({ size = 12, className, dir = 'right' }: IconProps & { dir?: 'left' | 'right' | 'up' | 'down' }) => {
  const rotate = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return (
    <svg {...base(size)} className={className} style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M6 3.6L10.4 8 6 12.4" />
    </svg>
  );
};

export const IconAlert = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8 2.2l6 11H2z" />
    <path d="M8 6.4v3.2M8 11.6v.4" />
  </svg>
);

export const IconLoader = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8 1.8a6.2 6.2 0 1 0 6.2 6.2" />
  </svg>
);
