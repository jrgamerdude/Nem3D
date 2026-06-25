import type { CameraState, Nem3DProjectV1 } from "../types";

type CreateProjectInput = {
  appVersion: string;
  sourceFileName: string;
  camera: CameraState;
  glbBytes: Uint8Array;
};

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function createProjectFile(input: CreateProjectInput): Nem3DProjectV1 {
  return {
    formatVersion: 1,
    appVersion: input.appVersion,
    savedAt: new Date().toISOString(),
    sourceFileName: input.sourceFileName,
    camera: input.camera,
    model: {
      kind: "glb-base64",
      data: bytesToBase64(input.glbBytes)
    }
  };
}

export function serializeProject(project: Nem3DProjectV1): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseProjectFile(contents: string): Nem3DProjectV1 {
  const parsed = JSON.parse(contents) as Partial<Nem3DProjectV1>;

  if (parsed.formatVersion !== 1) {
    throw new Error("Projektfilen har en ukendt version.");
  }

  if (!parsed.model || parsed.model.kind !== "glb-base64" || !parsed.model.data) {
    throw new Error("Projektfilen mangler en gyldig GLB-model.");
  }

  if (!parsed.camera || !Array.isArray(parsed.camera.position) || !Array.isArray(parsed.camera.target)) {
    throw new Error("Projektfilen mangler kamera-data.");
  }

  return parsed as Nem3DProjectV1;
}

export function decodeProjectModel(project: Nem3DProjectV1): Uint8Array {
  return base64ToBytes(project.model.data);
}
