import React, { useEffect } from "react";
import { Layout } from "./components/Layout/Layout";
import { useAutosave } from "./hooks/useAutosave";
import { useProjectStore } from "./store/projectStore";

const App: React.FC = () => {
  const loadProject = useProjectStore((s) => s.loadProject);

  // Attempt to restore last project on startup
  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Enable autosave
  useAutosave();

  return <Layout />;
};

export default App;
