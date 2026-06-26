import {
  Archive,
  BarChart3,
  Boxes,
  Download,
  FlaskConical,
  Gem,
  Home,
  Import,
  Layers3,
  Library,
  ScanLine,
  Search,
  Settings,
  Sparkles,
  Star,
  Tags,
  type LucideIcon,
} from "lucide-react";
import type { AppIconName } from "../types/navigation";

const icons: Record<AppIconName, LucideIcon> = {
  home: Home,
  sparkles: Sparkles,
  library: Library,
  search: Search,
  scan: ScanLine,
  archive: Archive,
  import: Import,
  analyzer: BarChart3,
  groups: Boxes,
  tags: Tags,
  test: FlaskConical,
  export: Download,
  settings: Settings,
  builder: Layers3,
  favorite: Star,
};

export function AppIcon({
  name,
  className,
  title,
}: {
  name: AppIconName;
  className?: string;
  title?: string;
}) {
  const Icon = icons[name] ?? Gem;

  return <Icon aria-hidden={!title} className={className} />;
}
