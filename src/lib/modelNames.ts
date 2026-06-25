export function makeProjectName(sourceFileName: string): string {
  const base = sourceFileName.replace(/\.(glb|gltf|nem3d)$/i, "");
  return `${base || "nem3d-projekt"}.nem3d`;
}

export function makeExportName(sourceFileName: string): string {
  const base = sourceFileName.replace(/\.(glb|gltf|nem3d)$/i, "");
  return `${base || "nem3d-model"}.glb`;
}
