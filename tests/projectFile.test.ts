import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64, createProjectFile, decodeProjectModel, parseProjectFile, serializeProject } from "../src/lib/projectFile";

describe("Nem3D project files", () => {
  it("round-trips GLB bytes and camera state", () => {
    const glbBytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 1, 2, 3, 4]);
    const project = createProjectFile({
      appVersion: "0.1.0",
      sourceFileName: "test.glb",
      camera: {
        position: [1, 2, 3],
        target: [0, 1, 0]
      },
      glbBytes
    });

    const parsed = parseProjectFile(serializeProject(project));

    expect(parsed.formatVersion).toBe(1);
    expect(parsed.sourceFileName).toBe("test.glb");
    expect(parsed.camera.position).toEqual([1, 2, 3]);
    expect(Array.from(decodeProjectModel(parsed))).toEqual(Array.from(glbBytes));
  });

  it("rejects unsupported project versions", () => {
    expect(() => parseProjectFile(JSON.stringify({ formatVersion: 99 }))).toThrow("ukendt version");
  });

  it("encodes and decodes base64 bytes", () => {
    const bytes = new Uint8Array([0, 64, 128, 255]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual([0, 64, 128, 255]);
  });
});
