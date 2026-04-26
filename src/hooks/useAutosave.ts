import { useEffect, useRef } from "react";
import { useProjectStore } from "../store/projectStore";

/** Autosaves the project every INTERVAL_MS if dirty */
const INTERVAL_MS = 8000;

export function useAutosave() {
  const isDirty = useProjectStore((s) => s.isDirty);
  const filePath = useProjectStore((s) => s.metadata.filePath);
  const saveProject = useProjectStore((s) => s.saveProject);
  const isDirtyRef = useRef(isDirty);
  const filePathRef = useRef(filePath);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);

  useEffect(() => {
    const timer = setInterval(async () => {
      // Only autosave if dirty AND already has a file path (don't trigger Save-As dialog)
      if (isDirtyRef.current && filePathRef.current) {
        await saveProject();
      }
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [saveProject]);
}
