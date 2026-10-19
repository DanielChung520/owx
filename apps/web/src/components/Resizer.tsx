import { useRef, type PointerEvent as ReactPointerEvent } from "react";

export function Resizer({
  onResize,
  label,
}: {
  onResize: (deltaX: number) => void;
  label: string;
}): JSX.Element {
  const lastX = useRef(0);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    lastX.current = event.clientX;
    const move = (moveEvent: PointerEvent): void => {
      onResize(moveEvent.clientX - lastX.current);
      lastX.current = moveEvent.clientX;
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={onPointerDown}
    />
  );
}
