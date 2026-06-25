import type { SelectionInfo } from "../types";

type InspectorProps = {
  selection: SelectionInfo;
  singleMeshNotice: boolean;
  onNumberChange: (kind: "position" | "rotation" | "scale", axis: 0 | 1 | 2, value: number) => void;
  onColorChange: (color: string) => void;
  onFocusSelected: () => void;
};

const axes = ["X", "Y", "Z"] as const;

export function Inspector({ selection, singleMeshNotice, onNumberChange, onColorChange, onFocusSelected }: InspectorProps) {
  return (
    <aside className="inspector" aria-label="Egenskaber">
      <div className="panel-heading">
        <span>Valgt del</span>
        <button className="text-button" type="button" onClick={onFocusSelected} disabled={!selection}>
          Fokus
        </button>
      </div>

      {singleMeshNotice ? (
        <div className="notice">
          Modellen består kun af én samlet mesh. Du kan stadig flytte, rotere, skalere og farve hele delen.
        </div>
      ) : null}

      {!selection ? (
        <div className="empty-state">
          <strong>Ingen del valgt</strong>
          <span>Klik på en del i 3D-visningen for at ændre den.</span>
        </div>
      ) : (
        <div className="inspector-content">
          <div className="selected-name">{selection.name}</div>
          <VectorEditor label="Position" values={selection.position} kind="position" onChange={onNumberChange} step={0.1} />
          <VectorEditor label="Rotation" values={selection.rotation} kind="rotation" onChange={onNumberChange} step={1} />
          <VectorEditor label="Størrelse" values={selection.scale} kind="scale" onChange={onNumberChange} step={0.05} min={0.01} />

          <label className="color-row">
            <span>Materiale</span>
            <input
              type="color"
              value={selection.color ?? "#5f8cff"}
              onChange={(event) => onColorChange(event.target.value)}
              aria-label="Farve"
            />
          </label>
        </div>
      )}
    </aside>
  );
}

type VectorEditorProps = {
  label: string;
  values: [number, number, number];
  kind: "position" | "rotation" | "scale";
  step: number;
  min?: number;
  onChange: (kind: "position" | "rotation" | "scale", axis: 0 | 1 | 2, value: number) => void;
};

function VectorEditor({ label, values, kind, step, min, onChange }: VectorEditorProps) {
  return (
    <div className="vector-editor">
      <span>{label}</span>
      <div className="axis-grid">
        {axes.map((axis, index) => (
          <label key={axis} className="axis-input">
            <span>{axis}</span>
            <input
              type="number"
              value={values[index]}
              step={step}
              min={min}
              onChange={(event) => onChange(kind, index as 0 | 1 | 2, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
