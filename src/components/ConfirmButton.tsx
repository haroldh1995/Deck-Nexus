import { useState } from "react";

export function ConfirmButton({
  children,
  confirmLabel = "Confirm",
  onConfirm,
  className,
}: {
  children: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  async function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    await onConfirm();
    setConfirming(false);
  }

  return (
    <button
      className={className}
      type="button"
      onBlur={() => setConfirming(false)}
      onClick={handleClick}
    >
      {confirming ? confirmLabel : children}
    </button>
  );
}
