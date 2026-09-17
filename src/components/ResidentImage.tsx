import {
  useCallback,
  useEffect,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from "react";
import {
  isImageReady,
  markImageReady,
  preloadImage,
} from "../app/imageReadiness";

export function ResidentImage({
  src,
  onLoad,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [status, setStatus] = useState(() => ({
    src,
    ready: isImageReady(src),
  }));

  useEffect(() => {
    let active = true;
    if (!src || isImageReady(src)) {
      return undefined;
    }

    void preloadImage(src)
      .then(() => {
        if (active) {
          setStatus({ src, ready: true });
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [src]);

  const ready = status.src === src ? status.ready : isImageReady(src);

  const handleLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      markImageReady(src);
      setStatus({ src, ready: true });
      onLoad?.(event);
    },
    [onLoad, src],
  );

  return (
    <img
      {...props}
      src={src}
      data-image-ready={ready ? "true" : "false"}
      onLoad={handleLoad}
    />
  );
}
