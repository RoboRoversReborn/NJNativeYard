import { getStatusMeta } from "@/lib/plants";
import type { NjPlantStatus, PlantStatus } from "@/lib/types";

export function StatusBadge({
  status,
  njStatus,
  short = false,
  className = "",
}: {
  status: PlantStatus;
  njStatus?: NjPlantStatus;
  short?: boolean;
  className?: string;
}) {
  const meta = getStatusMeta({ status, njStatus });

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.11em] ${className}`}
      style={{
        background: meta.soft,
        borderColor: meta.border,
        color: meta.color,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color }}
      />
      {short ? meta.short : meta.label}
    </span>
  );
}
