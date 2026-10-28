import { useEffect, useRef } from "react";

interface ResizeHandlesProps {
  onResize: (direction: string, deltaX: number, deltaY: number) => void;
  onResizeEnd: () => void;
}

const DIRECTIONS = [
  "nw", "n", "ne",
  "w",       "e",
  "sw", "s", "se",
];

const ResizeHandles = ({ onResize, onResizeEnd }: ResizeHandlesProps) => {
  const activeRef = useRef<{
    direction: string;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeRef.current) return;
      const { direction, startX, startY } = activeRef.current;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      onResize(direction, deltaX, deltaY);
    };

    const handleMouseUp = () => {
      if (activeRef.current) {
        activeRef.current = null;
        onResizeEnd();
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResize, onResizeEnd]);

  const handleMouseDown = (direction: string) => (
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    activeRef.current = {
      direction,
      startX: e.clientX,
      startY: e.clientY,
    };
    // Set cursor based on direction
    const cursorMap: Record<string, string> = {
      n: "ns-resize", s: "ns-resize",
      e: "ew-resize", w: "ew-resize",
      ne: "nesw-resize", sw: "nesw-resize",
      nw: "nwse-resize", se: "nwse-resize",
    };
    document.body.style.cursor = cursorMap[direction] || "default";
    document.body.style.userSelect = "none";
  };

  return (
    <>
      {DIRECTIONS.map((dir) => (
        <div
          key={dir}
          className={`resize-handle resize-handle-${dir}`}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={handleMouseDown(dir)}
        />
      ))}
    </>
  );
};

export default ResizeHandles;