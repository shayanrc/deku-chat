import type { SVGProps } from 'react';

function icon(paths: React.ReactNode) {
  return function Icon({ size = 15, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const ChevronDown = icon(<path d="m6 9 6 6 6-6" />);
export const ChevronRight = icon(<path d="m9 18 6-6-6-6" />);
export const Check = icon(<path d="M20 6 9 17l-5-5" />);
export const Plus = icon(<><path d="M5 12h14" /><path d="M12 5v14" /></>);
export const X = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const Sun = icon(
  <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
);
export const Moon = icon(<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />);
export const PanelLeft = icon(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></>);
export const TreeIcon = icon(
  <><circle cx="5" cy="6" r="2.5" /><circle cx="19" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M5 8.5v3a3 3 0 0 0 3 3h1.5M19 8.5v3a3 3 0 0 1-3 3h-1.5M12 14.5v1" /></>,
);
export const BranchIcon = icon(
  <g transform="rotate(180 12 12)"><line x1="6" x2="6" y1="3" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></g>,
);
export const RewindIcon = icon(<><path d="M3 12a9 9 0 1 0 3-7.3L3 8" /><path d="M3 3v5h5" /></>);
export const CombineIcon = icon(
  <g transform="rotate(180 12 12)"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" /></g>,
);
export const SummarizeIcon = icon(
  <><line x1="21" x2="3" y1="6" y2="6" /><line x1="15" x2="3" y1="12" y2="12" /><line x1="17" x2="3" y1="18" y2="18" /></>,
);
export const SearchIcon = icon(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>);
export const CodeIcon = icon(<><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></>);
export const SendIcon = icon(<><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>);
export const Pencil = icon(
  <><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /></>,
);
export const KeyIcon = icon(
  <><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" /></>,
);
export const Trash = icon(
  <><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></>,
);
