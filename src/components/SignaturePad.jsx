import React, { useRef, useState, useEffect } from 'react';
import { Eraser } from 'lucide-react';

// A drawn signature, not a typed name — the government/police audience this
// digitizes paper forms for expects something that reads as an actual
// signature, not a text field labeled "signature". Pointer events (not
// separate mouse/touch handlers) cover mouse, touch, and stylus in one path.
const SignaturePad = ({ onChange, height = 160 }) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';
  }, [height]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current.setPointerCapture(e.pointerId);
  };

  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current.toBlob(blob => onChange?.(blob), 'image/png');
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange?.(null);
  };

  return (
    <div>
      <div className="relative border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height }}
          className="touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasDrawn && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 font-bold uppercase tracking-widest pointer-events-none">
            Sign here
          </p>
        )}
      </div>
      <button type="button" onClick={clear} className="mt-2 flex items-center gap-1.5 text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition">
        <Eraser size={11} /> Clear
      </button>
    </div>
  );
};

export default SignaturePad;
