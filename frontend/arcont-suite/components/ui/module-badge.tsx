import type { ModuleContract } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";

export function ModuleBadge({ module }: { module: ModuleContract }) {
  const tone =
    module.area === "platform"
      ? "gold"
      : module.scope === "platform"
        ? "info"
        : module.enabledByDefault
          ? "success"
          : "neutral";

  return <Badge tone={tone}>{module.area.replace("_", " ")}</Badge>;
}
