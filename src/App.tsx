import { useCallback, useMemo, useRef, useState } from "react";
import {
  Box,
  Download,
  FolderOpen,
  HelpCircle,
  Move3D,
  Palette,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Scale3D,
  Undo2,
  UploadCloud
} from "lucide-react";
import { Inspector } from "./components/Inspector";
import { SceneViewport, type SceneViewportHandle } from "./components/SceneViewport";
import { StartGuide } from "./components/StartGuide";
import { checkForAppUpdate, openModelFile, openProjectFile, saveGlbFile, saveProjectFile } from "./lib/fileBridge";
import { createProjectFile, decodeProjectModel, parseProjectFile, serializeProject } from "./lib/projectFile";
import { makeExportName, makeProjectName } from "./lib/modelNames";
import type { SceneSummary, SelectionInfo, TransformMode } from "./types";

const appVersion = "0.1.1";

export function App() {
  const viewportRef = useRef<SceneViewportHandle | null>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>("translate");
  const [sceneSummary, setSceneSummary] = useState<SceneSummary | null>(null);
  const [selection, setSelection] = useState<SelectionInfo>(null);
  const [status, setStatus] = useState("Klar. Åbn en GLB/GLTF-model eller prøv eksempelmodellen.");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [guideOpen, setGuideOpen] = useState(() => localStorage.getItem("nem3d-guide-seen") !== "1");

  const currentSourceName = sceneSummary?.sourceFileName ?? "nem3d-model.glb";
  const modeLabel = useMemo(() => {
    if (transformMode === "translate") return "Flyt";
    if (transformMode === "rotate") return "Rotér";
    return "Skalér";
  }, [transformMode]);

  const runTask = useCallback(async (label: string, task: () => Promise<void>) => {
    try {
      setBusy(true);
      setStatus(label);
      await task();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Der skete en ukendt fejl.");
    } finally {
      setBusy(false);
    }
  }, []);

  const openModel = () =>
    runTask("Åbner model...", async () => {
      const file = await openModelFile();
      if (!file) {
        setStatus("Åbning blev annulleret.");
        return;
      }
      const summary = await viewportRef.current!.loadModel(file.bytes, file.name);
      setSceneSummary(summary);
    });

  const openProject = () =>
    runTask("Åbner projekt...", async () => {
      const file = await openProjectFile();
      if (!file) {
        setStatus("Åbning blev annulleret.");
        return;
      }
      const project = parseProjectFile(file.contents);
      const summary = await viewportRef.current!.loadModel(decodeProjectModel(project), project.sourceFileName, project.camera);
      setSceneSummary(summary);
      setStatus(`Projekt åbnet: ${file.name}`);
    });

  const loadSample = () =>
    runTask("Indlæser eksempelmodel...", async () => {
      const summary = await viewportRef.current!.loadSampleModel();
      setSceneSummary(summary);
    });

  const saveProject = () =>
    runTask("Gemmer projekt...", async () => {
      const viewport = viewportRef.current;
      if (!viewport || !sceneSummary) {
        throw new Error("Åbn en model før du gemmer projektet.");
      }
      const glbBytes = await viewport.exportGlb();
      const project = createProjectFile({
        appVersion,
        sourceFileName: currentSourceName,
        camera: viewport.captureCamera(),
        glbBytes
      });
      const savedPath = await saveProjectFile(makeProjectName(currentSourceName), serializeProject(project));
      setStatus(savedPath ? "Projekt gemt." : "Gemning blev annulleret.");
    });

  const exportGlb = () =>
    runTask("Eksporterer GLB...", async () => {
      const viewport = viewportRef.current;
      if (!viewport || !sceneSummary) {
        throw new Error("Åbn en model før du eksporterer.");
      }
      const glbBytes = await viewport.exportGlb();
      const savedPath = await saveGlbFile(makeExportName(currentSourceName), glbBytes);
      setStatus(savedPath ? "GLB eksporteret." : "Eksport blev annulleret.");
    });

  const checkUpdate = () =>
    runTask("Tjekker opdatering...", async () => {
      const result = await checkForAppUpdate();
      if (result === "unavailable") {
        setStatus("Opdatering kan kun tjekkes i desktop-appen.");
      } else if (result === "none") {
        setStatus("Du har allerede nyeste version.");
      }
    });

  const closeGuide = () => {
    localStorage.setItem("nem3d-guide-seen", "1");
    setGuideOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Box size={22} />
          </div>
          <div>
            <h1>Nem3D</h1>
            <span>Begyndervenlig 3D-editor</span>
          </div>
        </div>

        <nav className="command-bar" aria-label="Filhandlinger">
          <button type="button" onClick={openModel} disabled={busy} title="Åbn GLB/GLTF">
            <FolderOpen size={18} />
            <span>Åbn</span>
          </button>
          <button type="button" onClick={openProject} disabled={busy} title="Åbn Nem3D-projekt">
            <UploadCloud size={18} />
            <span>Projekt</span>
          </button>
          <button type="button" onClick={saveProject} disabled={busy || !sceneSummary} title="Gem projekt">
            <Save size={18} />
            <span>Gem</span>
          </button>
          <button type="button" onClick={exportGlb} disabled={busy || !sceneSummary} title="Eksportér GLB">
            <Download size={18} />
            <span>Eksportér</span>
          </button>
        </nav>

        <div className="top-actions">
          <button className="icon-button" type="button" onClick={checkUpdate} disabled={busy} title="Tjek opdatering">
            <RotateCw size={18} />
          </button>
          <button className="icon-button" type="button" onClick={() => setGuideOpen(true)} title="Hjælp">
            <HelpCircle size={18} />
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="tool-rail" aria-label="Værktøjer">
          <ToolButton active={transformMode === "translate"} label="Flyt" icon={<Move3D size={20} />} onClick={() => setTransformMode("translate")} />
          <ToolButton active={transformMode === "rotate"} label="Rotér" icon={<RotateCcw size={20} />} onClick={() => setTransformMode("rotate")} />
          <ToolButton active={transformMode === "scale"} label="Skalér" icon={<Scale3D size={20} />} onClick={() => setTransformMode("scale")} />
          <ToolButton active={false} label="Farve" icon={<Palette size={20} />} onClick={() => setStatus("Vælg en del og brug farvefeltet i højre panel.")} />

          <div className="rail-divider" />

          <button className="rail-mini" type="button" onClick={() => viewportRef.current?.undo()} disabled={!history.canUndo} title="Fortryd">
            <Undo2 size={18} />
          </button>
          <button className="rail-mini" type="button" onClick={() => viewportRef.current?.redo()} disabled={!history.canRedo} title="Gentag">
            <Redo2 size={18} />
          </button>
        </aside>

        <section className="canvas-region" aria-label="3D-editor">
          {!sceneSummary ? (
            <div className="welcome-card">
              <h2>Start med en model</h2>
              <p>Åbn en GLB/GLTF-fil, eller brug eksempelmodellen for at prøve værktøjerne med det samme.</p>
              <div className="welcome-actions">
                <button className="primary" type="button" onClick={openModel} disabled={busy}>
                  <FolderOpen size={18} />
                  Åbn model
                </button>
                <button className="secondary" type="button" onClick={loadSample} disabled={busy}>
                  <Box size={18} />
                  Prøv eksempel
                </button>
              </div>
            </div>
          ) : null}

          <SceneViewport
            ref={viewportRef}
            transformMode={transformMode}
            onSelectionChange={setSelection}
            onSceneSummaryChange={setSceneSummary}
            onHistoryChange={setHistory}
            onStatus={setStatus}
          />

          <div className="statusbar">
            <span>{busy ? "Arbejder..." : status}</span>
            <span>{sceneSummary ? `${sceneSummary.meshCount} dele · ${modeLabel}` : "Ingen model"}</span>
          </div>
        </section>

        <Inspector
          selection={selection}
          singleMeshNotice={Boolean(sceneSummary?.singleMesh)}
          onNumberChange={(kind, axis, value) => viewportRef.current?.updateSelectedTransform(kind, axis, value)}
          onColorChange={(color) => viewportRef.current?.updateSelectedColor(color)}
          onFocusSelected={() => viewportRef.current?.focusSelected()}
        />
      </main>

      <StartGuide open={guideOpen} onClose={closeGuide} />
    </div>
  );
}

type ToolButtonProps = {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

function ToolButton({ active, label, icon, onClick }: ToolButtonProps) {
  return (
    <button className={`tool-button ${active ? "active" : ""}`} type="button" onClick={onClick} title={label}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
