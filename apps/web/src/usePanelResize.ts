import { useCallback, useEffect, useRef, useState } from "react";

const LEFT_DEFAULT = 280;
const RIGHT_DEFAULT = 360;
const LEFT_MIN = 180;
const LEFT_MAX = 480;
const RIGHT_MIN = 260;
const RIGHT_MAX = 600;
const CENTER_MIN = 300;
const DIVIDER_PX = 6;

type DragState = {
  side: "left" | "right";
  startX: number;
  startWidth: number;
};

export function usePanelResize() {
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const clamp = useCallback(
    (side: "left" | "right", value: number) => {
      const shell = shellRef.current;
      const totalWidth = shell ? shell.offsetWidth : window.innerWidth;
      const otherSide = side === "left" ? rightWidth : leftWidth;
      const maxByCenter = totalWidth - otherSide - 2 * DIVIDER_PX - CENTER_MIN;
      const min = side === "left" ? LEFT_MIN : RIGHT_MIN;
      const max = side === "left" ? LEFT_MAX : RIGHT_MAX;
      return Math.round(Math.max(min, Math.min(max, maxByCenter, value)));
    },
    [leftWidth, rightWidth]
  );

  const onPointerDown = useCallback(
    (side: "left" | "right") => (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      document.body.classList.add("panel-dragging");
      dragRef.current = {
        side,
        startX: e.clientX,
        startWidth: side === "left" ? leftWidth : rightWidth
      };
    },
    [leftWidth, rightWidth]
  );

  const onPointerMove = useCallback(
    (side: "left" | "right") => (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.side !== side) return;
      const delta = e.clientX - drag.startX;
      const direction = side === "left" ? 1 : -1;
      const newWidth = drag.startWidth + delta * direction;
      if (side === "left") {
        setLeftWidth(clamp("left", newWidth));
      } else {
        setRightWidth(clamp("right", newWidth));
      }
    },
    [clamp]
  );

  const onPointerUp = useCallback(
    () => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      document.body.classList.remove("panel-dragging");
      dragRef.current = null;
    },
    []
  );

  const onDoubleClick = useCallback(() => {
    setLeftWidth(LEFT_DEFAULT);
    setRightWidth(RIGHT_DEFAULT);
  }, []);

  // Re-clamp on window resize
  useEffect(() => {
    const handleResize = () => {
      setLeftWidth((prev) => clamp("left", prev));
      setRightWidth((prev) => clamp("right", prev));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clamp]);

  const gridTemplateColumns = `${leftWidth}px ${DIVIDER_PX}px 1fr ${DIVIDER_PX}px ${rightWidth}px`;

  const leftDividerProps = {
    onPointerDown: onPointerDown("left"),
    onPointerMove: onPointerMove("left"),
    onPointerUp: onPointerUp(),
    onDoubleClick
  };

  const rightDividerProps = {
    onPointerDown: onPointerDown("right"),
    onPointerMove: onPointerMove("right"),
    onPointerUp: onPointerUp(),
    onDoubleClick
  };

  return {
    leftWidth,
    rightWidth,
    shellRef,
    leftDividerProps,
    rightDividerProps,
    gridTemplateColumns
  };
}
