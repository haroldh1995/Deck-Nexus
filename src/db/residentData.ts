import { defaultAppSettings } from "../data/defaults";
import type { AppSettings, Deck, FavoriteItem, OwnedCard } from "../types/domain";
import { nowIso } from "../utils/ids";
import {
  ensureAppSettings,
  listDecks,
  listFavorites,
  listOwnedCards,
} from "./repositories";

type ResidentResource<T> = {
  value: T | undefined;
  promise: Promise<T> | undefined;
  listeners: Set<() => void>;
};

function createResource<T>(): ResidentResource<T> {
  return { value: undefined, promise: undefined, listeners: new Set() };
}

function notify<T>(resource: ResidentResource<T>) {
  for (const listener of resource.listeners) {
    listener();
  }
}

function readResource<T>(resource: ResidentResource<T>, empty: T): T {
  return resource.value ?? empty;
}

function subscribe<T>(resource: ResidentResource<T>, listener: () => void) {
  resource.listeners.add(listener);
  return () => resource.listeners.delete(listener);
}

function loadResource<T>(
  resource: ResidentResource<T>,
  load: () => Promise<T>,
): Promise<T> {
  if (resource.value !== undefined) {
    return Promise.resolve(resource.value);
  }

  if (resource.promise) {
    return resource.promise;
  }

  resource.promise = load()
    .then((value) => {
      resource.value = value;
      notify(resource);
      return value;
    })
    .finally(() => {
      resource.promise = undefined;
    });

  return resource.promise;
}

function refreshResource<T>(
  resource: ResidentResource<T>,
  load: () => Promise<T>,
): Promise<T> {
  if (resource.promise) {
    return resource.promise;
  }

  resource.promise = load()
    .then((value) => {
      resource.value = value;
      notify(resource);
      return value;
    })
    .finally(() => {
      resource.promise = undefined;
    });

  return resource.promise;
}

const emptyDecks: Deck[] = [];
const emptyOwnedCards: OwnedCard[] = [];
const emptyFavorites: FavoriteItem[] = [];

const decksResource = createResource<Deck[]>();
const ownedCardsResource = createResource<OwnedCard[]>();
const favoritesResource = createResource<FavoriteItem[]>();
const settingsResource = createResource<AppSettings>();

export function getResidentDecks(): Deck[] {
  return readResource(decksResource, emptyDecks);
}

export function hasResidentDecks() {
  return decksResource.value !== undefined;
}

export function subscribeResidentDecks(listener: () => void) {
  return subscribe(decksResource, listener);
}

export function hydrateResidentDecks() {
  return loadResource(decksResource, listDecks);
}

export function refreshResidentDecks() {
  return refreshResource(decksResource, listDecks);
}

export function getResidentOwnedCards(): OwnedCard[] {
  return readResource(ownedCardsResource, emptyOwnedCards);
}

export function hasResidentOwnedCards() {
  return ownedCardsResource.value !== undefined;
}

export function subscribeResidentOwnedCards(listener: () => void) {
  return subscribe(ownedCardsResource, listener);
}

export function hydrateResidentOwnedCards() {
  return loadResource(ownedCardsResource, listOwnedCards);
}

export function refreshResidentOwnedCards() {
  return refreshResource(ownedCardsResource, listOwnedCards);
}

export function getResidentFavorites(): FavoriteItem[] {
  return readResource(favoritesResource, emptyFavorites);
}

export function hasResidentFavorites() {
  return favoritesResource.value !== undefined;
}

export function subscribeResidentFavorites(listener: () => void) {
  return subscribe(favoritesResource, listener);
}

export function hydrateResidentFavorites() {
  return loadResource(favoritesResource, listFavorites);
}

export function refreshResidentFavorites() {
  return refreshResource(favoritesResource, listFavorites);
}

export function getResidentSettings(): AppSettings | undefined {
  return settingsResource.value;
}

export function setResidentSettings(settings: AppSettings) {
  settingsResource.value = settings;
  notify(settingsResource);
}

export function subscribeResidentSettings(listener: () => void) {
  return subscribe(settingsResource, listener);
}

export function hydrateResidentSettings(): Promise<AppSettings> {
  return loadResource(settingsResource, async () => {
    const settings = await ensureAppSettings();
    return {
      ...defaultAppSettings,
      ...settings,
      localFirstMode: true as const,
      updatedAt: settings.updatedAt || nowIso(),
    };
  });
}

export function refreshResidentSettings() {
  return refreshResource(settingsResource, ensureAppSettings);
}

function clearResource<T>(resource: ResidentResource<T>) {
  resource.value = undefined;
  resource.promise = undefined;
  notify(resource);
}

if (typeof window !== "undefined") {
  window.addEventListener("deck-nexus:decks-updated", () => {
    void refreshResidentDecks().catch(() => undefined);
  });
  window.addEventListener("deck-nexus:owned-updated", () => {
    void refreshResidentOwnedCards().catch(() => undefined);
  });
  window.addEventListener("deck-nexus:scanner-updated", () => {
    void refreshResidentOwnedCards().catch(() => undefined);
  });
  window.addEventListener("deck-nexus:favorites-updated", () => {
    void refreshResidentFavorites().catch(() => undefined);
  });
  window.addEventListener("deck-nexus:settings-updated", () => {
    void refreshResidentSettings().catch(() => undefined);
  });
  window.addEventListener("deck-nexus:resident-reset", () => {
    clearResource(decksResource);
    clearResource(ownedCardsResource);
    clearResource(favoritesResource);
    clearResource(settingsResource);
  });
}
