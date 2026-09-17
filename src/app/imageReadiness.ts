const readyImages = new Set<string>();
const pendingImages = new Map<string, Promise<void>>();

export function isImageReady(src: string | undefined): boolean {
  return Boolean(src && readyImages.has(src));
}

export function markImageReady(src: string | undefined) {
  if (src) {
    readyImages.add(src);
  }
}

export function preloadImage(src: string | undefined): Promise<void> {
  if (!src || typeof window === "undefined") {
    return Promise.resolve();
  }

  if (readyImages.has(src)) {
    return Promise.resolve();
  }

  const pending = pendingImages.get(src);
  if (pending) {
    return pending;
  }

  const image = new window.Image();
  image.decoding = "async";
  const promise = new Promise<void>((resolve, reject) => {
    const complete = () => {
      markImageReady(src);
      resolve();
    };
    image.addEventListener("load", complete, { once: true });
    image.addEventListener("error", () => reject(new Error(`Image failed to load: ${src}`)), {
      once: true,
    });
    image.src = src;

    if (image.complete && image.naturalWidth > 0) {
      complete();
    }
  }).finally(() => {
    pendingImages.delete(src);
  });

  pendingImages.set(src, promise);
  return promise;
}

export function primeStaticImages(sources: readonly string[]) {
  return Promise.all(sources.map((source) => preloadImage(source)));
}

export function clearImageReadinessForTests() {
  readyImages.clear();
  pendingImages.clear();
}
