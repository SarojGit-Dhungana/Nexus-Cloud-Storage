import { useState, useRef, useCallback } from "react";

export function hasExternalFiles(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function useExternalFileDrop(onFiles: (files: File[]) => void) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  const onDragEnter = useCallback((event: React.DragEvent) => {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    depth.current += 1;
    setActive(true);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    if (!hasExternalFiles(event)) return;
    event.stopPropagation();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setActive(false);
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    depth.current = 0;
    setActive(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFiles(files);
  }, [onFiles]);

  return { active, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
