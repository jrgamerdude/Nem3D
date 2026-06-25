import type { LoadedFile } from "../types";

type SaveKind = "project" | "glb";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function extensionForSaveKind(kind: SaveKind): string {
  return kind === "project" ? "nem3d" : "glb";
}

function mimeForSaveKind(kind: SaveKind): string {
  return kind === "project" ? "application/json" : "model/gltf-binary";
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function openBrowserFile(accept: string): Promise<LoadedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);

    input.addEventListener("change", async () => {
      const file = input.files?.[0] ?? null;
      input.remove();

      if (!file) {
        resolve(null);
        return;
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      resolve({ name: file.name, bytes });
    });

    input.click();
  });
}

function saveBrowserFile(name: string, data: string | Uint8Array, kind: SaveKind): void {
  const blobData = typeof data === "string" ? data : toArrayBuffer(data);
  const blob = new Blob([blobData], { type: mimeForSaveKind(kind) });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name.endsWith(`.${extensionForSaveKind(kind)}`) ? name : `${name}.${extensionForSaveKind(kind)}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function openModelFile(): Promise<LoadedFile | null> {
  if (!isTauriRuntime()) {
    return openBrowserFile(".glb,.gltf");
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  const path = await open({
    multiple: false,
    filters: [{ name: "3D-model", extensions: ["glb", "gltf"] }]
  });

  if (!path || Array.isArray(path)) {
    return null;
  }

  const bytes = Uint8Array.from(await invoke<number[]>("read_binary_file", { path }));
  return { name: fileNameFromPath(path), bytes, path };
}

export async function openProjectFile(): Promise<{ name: string; contents: string; path?: string } | null> {
  if (!isTauriRuntime()) {
    const file = await openBrowserFile(".nem3d");
    return file ? { name: file.name, contents: new TextDecoder().decode(file.bytes) } : null;
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  const path = await open({
    multiple: false,
    filters: [{ name: "Nem3D-projekt", extensions: ["nem3d"] }]
  });

  if (!path || Array.isArray(path)) {
    return null;
  }

  const contents = await invoke<string>("read_text_file", { path });
  return { name: fileNameFromPath(path), contents, path };
}

export async function saveProjectFile(defaultName: string, contents: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    saveBrowserFile(defaultName, contents, "project");
    return defaultName;
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  const path = await save({
    defaultPath: defaultName.endsWith(".nem3d") ? defaultName : `${defaultName}.nem3d`,
    filters: [{ name: "Nem3D-projekt", extensions: ["nem3d"] }]
  });

  if (!path) {
    return null;
  }

  await invoke("write_text_file", { path, contents });
  return path;
}

export async function saveGlbFile(defaultName: string, bytes: Uint8Array): Promise<string | null> {
  if (!isTauriRuntime()) {
    saveBrowserFile(defaultName, bytes, "glb");
    return defaultName;
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  const path = await save({
    defaultPath: defaultName.endsWith(".glb") ? defaultName : `${defaultName}.glb`,
    filters: [{ name: "GLB-model", extensions: ["glb"] }]
  });

  if (!path) {
    return null;
  }

  await invoke("write_binary_file", { path, data: Array.from(bytes) });
  return path;
}

export async function checkForAppUpdate(): Promise<"updated" | "none" | "unavailable"> {
  if (!isTauriRuntime()) {
    return "unavailable";
  }

  const { check } = await import("@tauri-apps/plugin-updater");
  const { relaunch } = await import("@tauri-apps/plugin-process");
  const update = await check();

  if (!update) {
    return "none";
  }

  await update.downloadAndInstall();
  await relaunch();
  return "updated";
}
