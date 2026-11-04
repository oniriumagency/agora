export function Logo({ oscuro = false }: { oscuro?: boolean }) {
  return (
    <span className={`flex items-center gap-2 text-[22px] ${oscuro ? "text-white" : "text-gray-700"}`}>
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#1a73e8" />
        <rect x="12" y="20" width="28" height="24" rx="5" fill="#fff" />
        <path d="M40 29l12-7v20l-12-7z" fill="#fff" />
      </svg>
      <span>
        <span className="font-medium">Kubox</span> Meet
      </span>
    </span>
  );
}
