import type { SyncStatus } from "@/src/types/production";

type SyncStatusBadgeProps = {
  status: SyncStatus;
};

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  return (
    <section className="sync-badge">
      <p>Multi-Device Sync</p>
      <span className={status === "connected" ? "badge connected" : status === "pending" ? "badge pending" : "badge offline"}>
        {status === "connected" ? "Connected" : status === "pending" ? "Pending" : "Offline"}
      </span>
    </section>
  );
}
