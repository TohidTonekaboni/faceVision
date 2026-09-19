import type { CameraStatus } from "../../data/types";
import { useAppStore } from "../../store/appStore";

/** Cameras only ever report online/offline (see data/types.ts), but system
 * health items (used with StatusDot on the dashboard) can also be
 * "degraded" — this broader union covers both without forcing a fake
 * "degraded" camera state back into CameraStatus. */
export type DotStatus = "online" | "degraded" | "offline";

const COLOR: Record<CameraStatus, string> = { online: "rgba(20,184,166,.9)", offline: "rgba(100,116,139,.85)" };
const LABEL_EN: Record<CameraStatus, string> = { online: "ONLINE", offline: "OFFLINE" };
const LABEL_FA: Record<CameraStatus, string> = { online: "فعال", offline: "قطع" };
export const DOT_COLOR: Record<DotStatus, string> = { online: "#14B8A6", degraded: "#F59E0B", offline: "#64748B" };

export function StatusChip({ status }: { status: CameraStatus }) {
  const lang = useAppStore((s) => s.lang);
  return (
    <span
      className="px-[7px] py-[3px] rounded-[6px] text-[9.5px] font-semibold font-mono"
      style={{ background: COLOR[status], color: "#04070E", letterSpacing: ".06em" }}
    >
      {lang === "fa" ? LABEL_FA[status] : LABEL_EN[status]}
    </span>
  );
}

export function StatusDot({ status, className = "" }: { status: DotStatus; className?: string }) {
  return <span className={`w-[7px] h-[7px] rounded-full flex-none ${className}`} style={{ background: DOT_COLOR[status] }} />;
}
