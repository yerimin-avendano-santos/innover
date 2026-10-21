import type { SVGProps } from 'react';

export function IconoArea(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M5.5 2.5v11M2.5 5.5h11" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

export function IconoHabitacion(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <path d="M2 12V7.5A1.5 1.5 0 0 1 3.5 6h9A1.5 1.5 0 0 1 14 7.5V12" />
      <path d="M2 10h12M4 6V4.5A1.5 1.5 0 0 1 5.5 3h5A1.5 1.5 0 0 1 12 4.5V6" />
    </svg>
  );
}

export function IconoBano(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <path d="M2 8h12v1a3.5 3.5 0 0 1-3.5 3.5h-5A3.5 3.5 0 0 1 2 9V8Z" />
      <path d="M4 8V4a2 2 0 0 1 4 0M5 12.5v1M11 12.5v1" strokeLinecap="round" />
    </svg>
  );
}

export function IconoAuto(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <path d="M2 11h12M3.5 11V8L5 5h6l1.5 3v3" strokeLinejoin="round" />
      <circle cx="5" cy="11" r="1.5" />
      <circle cx="11" cy="11" r="1.5" />
    </svg>
  );
}
