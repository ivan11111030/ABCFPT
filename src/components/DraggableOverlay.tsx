"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

export type OverlayPosition = {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 10-100
};

export type OverlayLayout = "lower-third" | "top-bar" | "pip-corner" | "full" | "custom";

export const LAYOUT_PRESETS: Record<Exclude<OverlayLayout, "custom">, OverlayPosition> = {
  "lower-third": { x: 0, y: 75, width: 100 },
  "top-bar": { x: 0, y: 0, width: 100 },
  "pip-corner": { x: 65, y: 5, width: 32 },
  "full": { x: 0, y: 0, width: 100 },
};

type DraggableOverlayProps = {
  position: OverlayPosition;
  onPositionChange?: (pos: OverlayPosition) => void;
  children: ReactNode;
  interactive?: boolean;
};

export function DraggableOverlay({ position, onPositionChange, children, interactive = true }: DraggableOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; origW: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!interactive || !onPositionChange) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y };

    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ((ev.clientX - dragRef.current.startX) / rect.width) * 100;
      const dy = ((ev.clientY - dragRef.current.startY) / rect.height) * 100;
      onPositionChange({
        ...position,
        x: Math.max(0, Math.min(100 - position.width, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(95, dragRef.current.origY + dy)),
      });
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [interactive, onPositionChange, position]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!interactive || !onPositionChange) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, origW: position.width };

    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ((ev.clientX - resizeRef.current.startX) / rect.width) * 100;
      const newW = Math.max(15, Math.min(100, resizeRef.current.origW + dx));
      onPositionChange({ ...position, width: newW, x: Math.min(position.x, 100 - newW) });
    };

    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [interactive, onPositionChange, position]);

  return (
    <div
      ref={containerRef}
      className={`draggable-overlay${dragging ? " dragging" : ""}${interactive ? " interactive" : ""}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${position.width}%`,
      }}
      onMouseDown={handleDragStart}
    >
      {children}
      {interactive && onPositionChange && (
        <div className="overlay-resize-handle" onMouseDown={handleResizeStart} />
      )}
    </div>
  );
}
