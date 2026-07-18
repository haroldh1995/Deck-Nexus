import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";

export function FoundationScreen({
  title,
  status,
  summary,
}: {
  title: string;
  status: "Local" | "Unavailable" | "BoardState owned";
  summary: string;
}) {
  return (
    <div className="screen screen--narrow">
      <PageHeader title={title}>
        <StatusPill tone="violet">{status}</StatusPill>
      </PageHeader>
      <HolographicPanel>
        <p className="foundation-summary">{summary}</p>
      </HolographicPanel>
    </div>
  );
}
