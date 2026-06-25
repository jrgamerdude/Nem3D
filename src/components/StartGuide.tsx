import { Box, MousePointer2, Palette, Upload } from "lucide-react";

type StartGuideProps = {
  open: boolean;
  onClose: () => void;
};

export function StartGuide({ open, onClose }: StartGuideProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="start-guide" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <div className="guide-header">
          <div className="guide-mark">
            <Box size={26} />
          </div>
          <div>
            <h2 id="guide-title">Velkommen til Nem3D</h2>
            <p>En enkel 3D-editor til at åbne, ændre og eksportere modeller uden Blender-stress.</p>
          </div>
        </div>

        <div className="guide-steps">
          <div>
            <Upload size={22} />
            <strong>1. Åbn en model</strong>
            <span>Start med en GLB/GLTF-fil eller prøv eksempelmodellen.</span>
          </div>
          <div>
            <MousePointer2 size={22} />
            <strong>2. Vælg en del</strong>
            <span>Klik direkte på modellen og brug Flyt, Rotér eller Skalér.</span>
          </div>
          <div>
            <Palette size={22} />
            <strong>3. Skift farve</strong>
            <span>Brug panelet til højre og gem projektet eller eksportér GLB.</span>
          </div>
        </div>

        <button className="primary wide" type="button" onClick={onClose}>
          Start
        </button>
      </section>
    </div>
  );
}
