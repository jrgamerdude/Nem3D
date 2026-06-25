import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { CameraState, SceneSummary, SelectionInfo, TransformMode, Vec3Tuple } from "../types";

type SceneViewportProps = {
  transformMode: TransformMode;
  onSelectionChange: (selection: SelectionInfo) => void;
  onSceneSummaryChange: (summary: SceneSummary | null) => void;
  onHistoryChange: (state: { canUndo: boolean; canRedo: boolean }) => void;
  onStatus: (message: string) => void;
};

export type SceneViewportHandle = {
  loadModel: (bytes: Uint8Array, sourceFileName: string, camera?: CameraState) => Promise<SceneSummary>;
  loadSampleModel: () => Promise<SceneSummary>;
  exportGlb: () => Promise<Uint8Array>;
  captureCamera: () => CameraState;
  updateSelectedTransform: (kind: "position" | "rotation" | "scale", axis: 0 | 1 | 2, value: number) => SelectionInfo | null;
  updateSelectedColor: (color: string) => SelectionInfo | null;
  undo: () => void;
  redo: () => void;
  focusSelected: () => void;
};

type MeshSnapshot = {
  id: string;
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
  color: string | null;
};

type SceneSnapshot = MeshSnapshot[];

type SceneRefs = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  transform: TransformControls;
  grid: THREE.GridHelper;
  modelRoot: THREE.Object3D | null;
  selected: THREE.Object3D | null;
  selectableMeshes: THREE.Mesh[];
  history: SceneSnapshot[];
  redo: SceneSnapshot[];
  sourceFileName: string;
};

const defaultCameraState: CameraState = {
  position: [4.5, 3.2, 5.2],
  target: [0, 0.8, 0]
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function tupleFromVector(vector: THREE.Vector3): Vec3Tuple {
  return [round(vector.x), round(vector.y), round(vector.z)];
}

function tupleFromEuler(euler: THREE.Euler): Vec3Tuple {
  return [round(THREE.MathUtils.radToDeg(euler.x)), round(THREE.MathUtils.radToDeg(euler.y)), round(THREE.MathUtils.radToDeg(euler.z))];
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function normalizeHex(color: string): string {
  return color.startsWith("#") ? color : `#${color}`;
}

function getObjectName(object: THREE.Object3D): string {
  return object.name?.trim() || object.parent?.name?.trim() || "Del uden navn";
}

function getFirstMaterial(object: THREE.Object3D): THREE.Material | null {
  const mesh = object as THREE.Mesh;
  const material = mesh.material;
  if (Array.isArray(material)) {
    return material[0] ?? null;
  }
  return material ?? null;
}

function materialColor(object: THREE.Object3D): string | null {
  const material = getFirstMaterial(object) as THREE.MeshStandardMaterial | null;
  if (!material || !("color" in material)) {
    return null;
  }
  return `#${material.color.getHexString()}`;
}

function selectionInfo(object: THREE.Object3D | null): SelectionInfo {
  if (!object) {
    return null;
  }

  return {
    id: object.uuid,
    name: getObjectName(object),
    position: tupleFromVector(object.position),
    rotation: tupleFromEuler(object.rotation),
    scale: tupleFromVector(object.scale),
    color: materialColor(object)
  };
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshes.push(child as THREE.Mesh);
    }
  });
  return meshes;
}

function cloneMaterialForEditing(mesh: THREE.Mesh): void {
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((material) => material.clone());
    return;
  }
  mesh.material = mesh.material.clone();
}

function frameObject(refs: SceneRefs, targetObject?: THREE.Object3D): void {
  const object = targetObject ?? refs.modelRoot;
  if (!object) {
    refs.camera.position.set(...defaultCameraState.position);
    refs.orbit.target.set(...defaultCameraState.target);
    refs.orbit.update();
    return;
  }

  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) {
    return;
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1);
  const distance = maxSize * 1.8;
  refs.camera.position.copy(center).add(new THREE.Vector3(distance, distance * 0.65, distance));
  refs.camera.near = Math.max(distance / 100, 0.01);
  refs.camera.far = Math.max(distance * 100, 1000);
  refs.camera.updateProjectionMatrix();
  refs.orbit.target.copy(center);
  refs.orbit.update();
}

function applyCameraState(refs: SceneRefs, camera: CameraState): void {
  refs.camera.position.set(...camera.position);
  refs.orbit.target.set(...camera.target);
  refs.orbit.update();
}

function snapshotScene(refs: SceneRefs): SceneSnapshot {
  return refs.selectableMeshes.map((mesh) => ({
    id: mesh.uuid,
    position: tupleFromVector(mesh.position),
    rotation: tupleFromEuler(mesh.rotation),
    scale: tupleFromVector(mesh.scale),
    color: materialColor(mesh)
  }));
}

function restoreSnapshot(refs: SceneRefs, snapshot: SceneSnapshot): void {
  const meshMap = new Map(refs.selectableMeshes.map((mesh) => [mesh.uuid, mesh]));

  for (const item of snapshot) {
    const mesh = meshMap.get(item.id);
    if (!mesh) {
      continue;
    }

    mesh.position.set(...item.position);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(item.rotation[0]),
      THREE.MathUtils.degToRad(item.rotation[1]),
      THREE.MathUtils.degToRad(item.rotation[2])
    );
    mesh.scale.set(...item.scale);

    if (item.color) {
      setObjectColor(mesh, item.color);
    }
  }
}

function snapshotsEqual(left: SceneSnapshot, right: SceneSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pushHistory(refs: SceneRefs, notify: (state: { canUndo: boolean; canRedo: boolean }) => void, before: SceneSnapshot): void {
  const after = snapshotScene(refs);
  if (snapshotsEqual(before, after)) {
    return;
  }
  refs.history.push(before);
  refs.redo = [];
  notify({ canUndo: refs.history.length > 0, canRedo: refs.redo.length > 0 });
}

function setObjectColor(object: THREE.Object3D, color: string): void {
  const normalized = normalizeHex(color);
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const standardMaterial = material as THREE.MeshStandardMaterial;
      if ("color" in standardMaterial) {
        standardMaterial.color.set(normalized);
        standardMaterial.needsUpdate = true;
      }
    }
  });
}

function createSampleRoot(): THREE.Group {
  const root = new THREE.Group();
  root.name = "Eksempelmodel";

  const baseMaterial = new THREE.MeshStandardMaterial({ color: "#5f8cff", roughness: 0.55, metalness: 0.05 });
  const cabinMaterial = new THREE.MeshStandardMaterial({ color: "#7cc98a", roughness: 0.62, metalness: 0.02 });
  const detailMaterial = new THREE.MeshStandardMaterial({ color: "#f2b84b", roughness: 0.5, metalness: 0.08 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 1.25), baseMaterial);
  base.name = "Base";
  base.position.y = 0.25;
  root.add(base);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.95, 0.95), cabinMaterial);
  cabin.name = "Midterdel";
  cabin.position.set(-0.25, 0.93, 0);
  root.add(cabin);

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.15, 24), detailMaterial);
  tower.name = "Top";
  tower.position.set(0.72, 1.2, 0);
  root.add(tower);

  return root;
}

export const SceneViewport = forwardRef<SceneViewportHandle, SceneViewportProps>(function SceneViewport(
  { transformMode, onSelectionChange, onSceneSummaryChange, onHistoryChange, onStatus },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const refsRef = useRef<SceneRefs | null>(null);
  const transformStartRef = useRef<SceneSnapshot | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#eef2f6");
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef2f6");

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
    camera.position.set(...defaultCameraState.position);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.target.set(...defaultCameraState.target);
    orbit.update();

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.86);
    scene.add(transform.getHelper());

    const grid = new THREE.GridHelper(8, 16, "#a9b4c2", "#d4dae2");
    grid.position.y = 0;
    scene.add(grid);

    const ambient = new THREE.HemisphereLight("#ffffff", "#b8c0cb", 2.2);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight("#ffffff", 2.6);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#d9ecff", 1.1);
    fillLight.position.set(-4, 3, -5);
    scene.add(fillLight);

    const refsObject: SceneRefs = {
      renderer,
      scene,
      camera,
      orbit,
      transform,
      grid,
      modelRoot: null,
      selected: null,
      selectableMeshes: [],
      history: [],
      redo: [],
      sourceFileName: "eksempel.glb"
    };
    refsRef.current = refsObject;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || refsObject.transform.dragging || !refsObject.selectableMeshes.length) {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(refsObject.selectableMeshes, false)[0];

      refsObject.selected = hit?.object ?? null;
      if (refsObject.selected) {
        transform.attach(refsObject.selected);
        onStatus(`Valgt: ${getObjectName(refsObject.selected)}`);
      } else {
        transform.detach();
      }
      onSelectionChange(selectionInfo(refsObject.selected));
    };

    transform.addEventListener("dragging-changed", (event) => {
      orbit.enabled = !event.value;
    });

    transform.addEventListener("mouseDown", () => {
      transformStartRef.current = snapshotScene(refsObject);
    });

    transform.addEventListener("objectChange", () => {
      onSelectionChange(selectionInfo(refsObject.selected));
    });

    transform.addEventListener("mouseUp", () => {
      if (!transformStartRef.current) {
        return;
      }
      pushHistory(refsObject, onHistoryChange, transformStartRef.current);
      transformStartRef.current = null;
    });

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    let frame = 0;
    const renderLoop = () => {
      orbit.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      transform.detach();
      transform.dispose();
      orbit.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      refsRef.current = null;
    };
  }, [onHistoryChange, onSceneSummaryChange, onSelectionChange, onStatus]);

  useEffect(() => {
    refsRef.current?.transform.setMode(transformMode);
  }, [transformMode]);

  useImperativeHandle(ref, () => ({
    async loadModel(bytes, sourceFileName, camera) {
      const refs = refsRef.current;
      if (!refs) {
        throw new Error("3D-visningen er ikke klar endnu.");
      }

      const loader = new GLTFLoader();
      const model = await new Promise<THREE.Object3D>((resolve, reject) => {
        const isTextGltf = sourceFileName.toLowerCase().endsWith(".gltf");
        const payload: string | ArrayBuffer = isTextGltf ? new TextDecoder().decode(bytes) : toArrayBuffer(bytes);
        loader.parse(
          payload,
          "",
          (gltf) => resolve(gltf.scene),
          (error) => reject(error instanceof Error ? error : new Error("Modellen kunne ikke indlæses."))
        );
      });

      model.name = sourceFileName;
      return installModel(refs, model, sourceFileName, camera);
    },

    async loadSampleModel() {
      const refs = refsRef.current;
      if (!refs) {
        throw new Error("3D-visningen er ikke klar endnu.");
      }

      return installModel(refs, createSampleRoot(), "eksempel.glb");
    },

    async exportGlb() {
      const refs = refsRef.current;
      if (!refs?.modelRoot) {
        throw new Error("Der er ingen model at eksportere endnu.");
      }

      const root = refs.modelRoot;
      const exporter = new GLTFExporter();
      const result = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          root,
          (output) => {
            if (output instanceof ArrayBuffer) {
              resolve(output);
              return;
            }
            const json = JSON.stringify(output);
            resolve(toArrayBuffer(new TextEncoder().encode(json)));
          },
          (error) => reject(error),
          { binary: true, trs: false, onlyVisible: true }
        );
      });

      return new Uint8Array(result);
    },

    captureCamera() {
      const refs = refsRef.current;
      if (!refs) {
        return defaultCameraState;
      }
      return {
        position: tupleFromVector(refs.camera.position),
        target: tupleFromVector(refs.orbit.target)
      };
    },

    updateSelectedTransform(kind, axis, value) {
      const refs = refsRef.current;
      if (!refs?.selected) {
        return null;
      }

      const before = snapshotScene(refs);
      if (kind === "rotation") {
        const radians = THREE.MathUtils.degToRad(value);
        if (axis === 0) refs.selected.rotation.x = radians;
        if (axis === 1) refs.selected.rotation.y = radians;
        if (axis === 2) refs.selected.rotation.z = radians;
      } else {
        refs.selected[kind].setComponent(axis, value);
      }
      pushHistory(refs, onHistoryChange, before);
      const info = selectionInfo(refs.selected);
      onSelectionChange(info);
      return info;
    },

    updateSelectedColor(color) {
      const refs = refsRef.current;
      if (!refs?.selected) {
        return null;
      }

      const before = snapshotScene(refs);
      setObjectColor(refs.selected, color);
      pushHistory(refs, onHistoryChange, before);
      const info = selectionInfo(refs.selected);
      onSelectionChange(info);
      return info;
    },

    undo() {
      const refs = refsRef.current;
      if (!refs || refs.history.length === 0) {
        return;
      }
      const current = snapshotScene(refs);
      const previous = refs.history.pop();
      if (!previous) {
        return;
      }
      refs.redo.push(current);
      restoreSnapshot(refs, previous);
      onHistoryChange({ canUndo: refs.history.length > 0, canRedo: refs.redo.length > 0 });
      onSelectionChange(selectionInfo(refs.selected));
    },

    redo() {
      const refs = refsRef.current;
      if (!refs || refs.redo.length === 0) {
        return;
      }
      const current = snapshotScene(refs);
      const next = refs.redo.pop();
      if (!next) {
        return;
      }
      refs.history.push(current);
      restoreSnapshot(refs, next);
      onHistoryChange({ canUndo: refs.history.length > 0, canRedo: refs.redo.length > 0 });
      onSelectionChange(selectionInfo(refs.selected));
    },

    focusSelected() {
      const refs = refsRef.current;
      if (!refs) {
        return;
      }
      frameObject(refs, refs.selected ?? refs.modelRoot ?? undefined);
    }
  }));

  function installModel(refs: SceneRefs, model: THREE.Object3D, sourceFileName: string, camera?: CameraState): SceneSummary {
    if (refs.modelRoot) {
      refs.scene.remove(refs.modelRoot);
    }

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        cloneMaterialForEditing(mesh);
      }
    });

    refs.modelRoot = model;
    refs.sourceFileName = sourceFileName;
    refs.selected = null;
    refs.selectableMeshes = collectMeshes(model);
    refs.history = [];
    refs.redo = [];
    refs.transform.detach();
    refs.scene.add(model);

    if (camera) {
      applyCameraState(refs, camera);
    } else {
      frameObject(refs);
    }

    const summary: SceneSummary = {
      sourceFileName,
      meshCount: refs.selectableMeshes.length,
      selectablePartCount: refs.selectableMeshes.length,
      singleMesh: refs.selectableMeshes.length <= 1
    };

    onSelectionChange(null);
    onSceneSummaryChange(summary);
    onHistoryChange({ canUndo: false, canRedo: false });
    onStatus(summary.singleMesh ? "Modellen er indlæst som én samlet del." : `Modellen er indlæst med ${summary.meshCount} dele.`);
    return summary;
  }

  return (
    <div className="viewport-shell">
      <div ref={containerRef} className="viewport-canvas" aria-label="3D-visning" />
      <div className="viewport-hint">Klik på en del for at vælge den. Træk i håndtagene for at ændre modellen.</div>
    </div>
  );
});
