import { permanentHomeRoutes } from "../../data/routes";
import type { FavoriteItem } from "../../types/domain";
import type { HomeOrbitItem } from "../../types/navigation";

export const permanentHomeOrbitItems: HomeOrbitItem[] =
  permanentHomeRoutes.map((route) => ({
    id: route.id,
    label: route.label,
    shortLabel: route.shortLabel,
    route: route.path,
    icon: route.icon,
    kind: "permanent",
  }));

export function buildHomeOrbitItems(
  favorites: readonly FavoriteItem[],
  order: readonly string[],
  hiddenIds: readonly string[] = [],
): HomeOrbitItem[] {
  const hiddenIdSet = new Set(hiddenIds);
  const dynamicItems: HomeOrbitItem[] = favorites.map((favorite) => ({
    id: `favorite:${favorite.id}`,
    label: favorite.title,
    shortLabel: favorite.title,
    route: favorite.route,
    icon: "favorite",
    kind: favorite.type,
    subtitle: favorite.subtitle,
  }));

  const items = [...permanentHomeOrbitItems, ...dynamicItems];
  const orderedIds = new Map(order.map((id, index) => [id, index]));

  return items
    .filter((item) => item.kind === "permanent" || !hiddenIdSet.has(item.id))
    .sort((a, b) => {
      const aOrder = orderedIds.get(a.id);
      const bOrder = orderedIds.get(b.id);

      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder;
      }

      if (aOrder !== undefined) {
        return -1;
      }

      if (bOrder !== undefined) {
        return 1;
      }

      return items.indexOf(a) - items.indexOf(b);
    });
}

export function moveHomeOrbitItem(
  items: readonly HomeOrbitItem[],
  itemId: string,
  direction: -1 | 1,
): HomeOrbitItem[] {
  const currentIndex = items.findIndex((item) => item.id === itemId);

  if (currentIndex < 0) {
    return [...items];
  }

  const nextIndex = currentIndex + direction;

  if (nextIndex < 0 || nextIndex >= items.length) {
    return [...items];
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(currentIndex, 1);
  nextItems.splice(nextIndex, 0, item);
  return nextItems;
}

export function reorderHomeOrbitItems(
  items: readonly HomeOrbitItem[],
  draggedId: string,
  targetId: string,
): HomeOrbitItem[] {
  if (draggedId === targetId) {
    return [...items];
  }

  const draggedIndex = items.findIndex((item) => item.id === draggedId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (draggedIndex < 0 || targetIndex < 0) {
    return [...items];
  }

  const nextItems = [...items];
  const [draggedItem] = nextItems.splice(draggedIndex, 1);
  nextItems.splice(targetIndex, 0, draggedItem);
  return nextItems;
}
