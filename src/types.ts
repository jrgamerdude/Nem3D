export type Vec3Tuple = [number, number, number];

export type CameraState = {
  position: Vec3Tuple;
  target: Vec3Tuple;
};

export type Nem3DProjectV1 = {
  formatVersion: 1;
  appVersion: string;
  savedAt: string;
  sourceFileName: string;
  camera: CameraState;
  model: {
    kind: "glb-base64";
    data: string;
  };
};

export type TransformMode = "translate" | "rotate" | "scale";

export type SceneSummary = {
  sourceFileName: string;
  meshCount: number;
  selectablePartCount: number;
  singleMesh: boolean;
};

export type SelectionInfo = {
  id: string;
  name: string;
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
  color: string | null;
} | null;

export type LoadedFile = {
  name: string;
  bytes: Uint8Array;
  path?: string;
};
