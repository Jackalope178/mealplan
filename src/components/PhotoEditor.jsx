import React, { useState, useRef, useCallback, useEffect } from 'react';

// Simple photo editor: crop, rotate, replace
export default function PhotoEditor({ src, onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [cropStart, setCropStart] = useState(null);
  const [cropEnd, setCropEnd] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [replacing, setReplacing] = useState(false);

  // Load image
  const loadImage = useCallback((source) => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setRotation(0);
      setCropStart(null);
      setCropEnd(null);
    };
    image.src = source;
  }, []);

  useEffect(() => {
    if (src) loadImage(src);
  }, [src, loadImage]);

  // Draw canvas
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const maxW = Math.min(440, window.innerWidth - 40);

    const isRotated = rotation % 180 !== 0;
    const srcW = isRotated ? img.height : img.width;
    const srcH = isRotated ? img.width : img.height;
    const scale = maxW / srcW;
    const dispW = Math.round(srcW * scale);
    const dispH = Math.round(srcH * scale);

    canvas.width = dispW;
    canvas.height = dispH;

    ctx.clearRect(0, 0, dispW, dispH);
    ctx.save();
    ctx.translate(dispW / 2, dispH / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const drawW = rotation % 180 !== 0 ? dispH : dispW;
    const drawH = rotation % 180 !== 0 ? dispW : dispH;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Draw crop overlay
    if (cropStart && cropEnd) {
      const x = Math.min(cropStart.x, cropEnd.x);
      const y = Math.min(cropStart.y, cropEnd.y);
      const w = Math.abs(cropEnd.x - cropStart.x);
      const h = Math.abs(cropEnd.y - cropStart.y);

      // Darken outside
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, dispW, y);
      ctx.fillRect(0, y + h, dispW, dispH - y - h);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, dispW - x - w, h);

      // Border
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  }, [img, rotation, cropStart, cropEnd]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: Math.round(touch.clientX - rect.left),
      y: Math.round(touch.clientY - rect.top),
    };
  };

  const handleStart = (e) => {
    if (!isCropping) return;
    e.preventDefault();
    const pos = getPos(e);
    setCropStart(pos);
    setCropEnd(pos);
  };

  const handleMove = (e) => {
    if (!isCropping || !cropStart) return;
    e.preventDefault();
    setCropEnd(getPos(e));
  };

  const handleEnd = () => {
    // Crop selection done
  };

  const rotate90 = () => setRotation((rotation + 90) % 360);

  const applyCrop = () => {
    if (!cropStart || !cropEnd || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const w = Math.abs(cropEnd.x - cropStart.x);
    const h = Math.abs(cropEnd.y - cropStart.y);

    if (w < 20 || h < 20) return;

    // Get cropped image data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

    const croppedUrl = tempCanvas.toDataURL('image/jpeg', 0.85);
    const newImg = new Image();
    newImg.onload = () => {
      setImg(newImg);
      setRotation(0);
      setCropStart(null);
      setCropEnd(null);
      setIsCropping(false);
    };
    newImg.src = croppedUrl;
  };

  const handleReplace = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplacing(true);
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    loadImage(dataUrl);
    setReplacing(false);
    e.target.value = '';
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    // Re-render without crop overlay then export
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const isRotated = rotation % 180 !== 0;
    const srcW = isRotated ? img.height : img.width;
    const srcH = isRotated ? img.width : img.height;
    const maxSize = 400;
    const scale = maxSize / Math.max(srcW, srcH);
    const outW = Math.round(srcW * scale);
    const outH = Math.round(srcH * scale);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');

    outCtx.translate(outW / 2, outH / 2);
    outCtx.rotate((rotation * Math.PI) / 180);
    const drawW = rotation % 180 !== 0 ? outH : outW;
    const drawH = rotation % 180 !== 0 ? outW : outH;
    outCtx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

    onSave(outCanvas.toDataURL('image/jpeg', 0.8));
  };

  if (!img) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Photo</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>

        {/* Canvas */}
        <div style={{ textAlign: 'center', marginBottom: 16, touchAction: isCropping ? 'none' : 'auto' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            style={{
              maxWidth: '100%', borderRadius: 'var(--radius-sm)',
              cursor: isCropping ? 'crosshair' : 'default',
            }}
          />
        </div>

        {/* Tools */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={rotate90} style={{ flex: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
            Rotate
          </button>

          {!isCropping ? (
            <button className="btn btn-secondary btn-sm" onClick={() => setIsCropping(true)} style={{ flex: 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                <path d="M6 2v14a2 2 0 002 2h14" />
                <path d="M18 22V8a2 2 0 00-2-2H2" />
              </svg>
              Crop
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={applyCrop} style={{ flex: 1 }}>
              Apply Crop
            </button>
          )}

          <label className="btn btn-secondary btn-sm" style={{ flex: 1, cursor: 'pointer', position: 'relative' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {replacing ? '...' : 'Replace'}
            <input type="file" accept="image/*" onChange={handleReplace}
              style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
          </label>
        </div>

        {isCropping && (
          <p style={{ fontSize: 14, color: 'var(--text-light)', textAlign: 'center', marginBottom: 12 }}>
            Drag on the photo to select the area you want to keep.
          </p>
        )}

        {/* Save */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary btn-full" onClick={handleSave} style={{ fontSize: 18 }}>
            Save Photo
          </button>
        </div>
      </div>
    </div>
  );
}
