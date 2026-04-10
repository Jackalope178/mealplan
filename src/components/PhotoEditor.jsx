import React, { useState, useRef, useEffect } from 'react';

// Each edit (rotate/crop) bakes into a new dataUrl immediately.
// No stacking transforms — what you see is what you get.

function drawImage(imgEl, maxW) {
  var scale = maxW / imgEl.width;
  if (scale > 1) scale = 1;
  var w = Math.round(imgEl.width * scale);
  var h = Math.round(imgEl.height * scale);
  var c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(imgEl, 0, 0, w, h);
  return c;
}

function loadImg(src) {
  return new Promise(function(resolve) {
    var i = new Image();
    i.onload = function() { resolve(i); };
    i.src = src;
  });
}

export default function PhotoEditor({ src, onSave, onCancel }) {
  var [dataUrl, setDataUrl] = useState(src);
  var [cropMode, setCropMode] = useState(false);
  var [cropBox, setCropBox] = useState(null); // {x,y,w,h} in display coords
  var [dragging, setDragging] = useState(false);
  var [startPt, setStartPt] = useState(null);
  var canvasRef = useRef(null);
  var imgRef = useRef(null);
  var displaySize = useRef({ w: 0, h: 0, scale: 1 });

  // Draw current image to preview canvas
  useEffect(function() {
    if (!dataUrl || !canvasRef.current) return;
    loadImg(dataUrl).then(function(img) {
      imgRef.current = img;
      var canvas = canvasRef.current;
      var maxW = Math.min(440, window.innerWidth - 40);
      var scale = Math.min(maxW / img.width, 1);
      var w = Math.round(img.width * scale);
      var h = Math.round(img.height * scale);
      canvas.width = w;
      canvas.height = h;
      displaySize.current = { w: w, h: h, scale: scale };
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    });
  }, [dataUrl]);

  // Draw crop overlay on top
  useEffect(function() {
    if (!cropBox || !imgRef.current || !canvasRef.current) return;
    var canvas = canvasRef.current;
    var ctx = canvas.getContext('2d');
    var d = displaySize.current;
    // Redraw image first
    ctx.drawImage(imgRef.current, 0, 0, d.w, d.h);
    // Dark overlay outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, d.w, cropBox.y);
    ctx.fillRect(0, cropBox.y + cropBox.h, d.w, d.h - cropBox.y - cropBox.h);
    ctx.fillRect(0, cropBox.y, cropBox.x, cropBox.h);
    ctx.fillRect(cropBox.x + cropBox.w, cropBox.y, d.w - cropBox.x - cropBox.w, cropBox.h);
    // White border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
  }, [cropBox]);

  function getPos(e) {
    var rect = canvasRef.current.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (!cropMode) return;
    e.preventDefault();
    var p = getPos(e);
    setStartPt(p);
    setCropBox({ x: p.x, y: p.y, w: 0, h: 0 });
    setDragging(true);
  }

  function onPointerMove(e) {
    if (!dragging || !startPt) return;
    e.preventDefault();
    var p = getPos(e);
    setCropBox({
      x: Math.min(startPt.x, p.x),
      y: Math.min(startPt.y, p.y),
      w: Math.abs(p.x - startPt.x),
      h: Math.abs(p.y - startPt.y),
    });
  }

  function onPointerUp() {
    setDragging(false);
  }

  function doRotate() {
    if (!imgRef.current) return;
    var img = imgRef.current;
    var c = document.createElement('canvas');
    c.width = img.height;
    c.height = img.width;
    var ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    setDataUrl(c.toDataURL('image/jpeg', 0.85));
    setCropBox(null);
    setCropMode(false);
  }

  function doCrop() {
    if (!cropBox || cropBox.w < 20 || cropBox.h < 20 || !imgRef.current) return;
    var img = imgRef.current;
    var s = displaySize.current.scale;
    // Convert display coords to actual image coords
    var sx = Math.round(cropBox.x / s);
    var sy = Math.round(cropBox.y / s);
    var sw = Math.round(cropBox.w / s);
    var sh = Math.round(cropBox.h / s);
    // Clamp
    sx = Math.max(0, Math.min(sx, img.width));
    sy = Math.max(0, Math.min(sy, img.height));
    sw = Math.min(sw, img.width - sx);
    sh = Math.min(sh, img.height - sy);

    var c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    setDataUrl(c.toDataURL('image/jpeg', 0.85));
    setCropBox(null);
    setCropMode(false);
  }

  function doReplace(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function() { setDataUrl(reader.result); setCropBox(null); setCropMode(false); };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function doSave() {
    if (!imgRef.current) return;
    // Export at max 400px for thumbnail
    var img = imgRef.current;
    var max = 400;
    var scale = Math.min(max / Math.max(img.width, img.height), 1);
    var c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    onSave(c.toDataURL('image/jpeg', 0.8));
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={function(e) { e.stopPropagation(); }}>
        <div className="modal-header">
          <h2>Edit Photo</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 16, touchAction: cropMode ? 'none' : 'auto' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
            style={{
              maxWidth: '100%', borderRadius: 'var(--radius-sm)',
              cursor: cropMode ? 'crosshair' : 'default',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={doRotate} style={{ flex: 1 }}>
            Rotate
          </button>

          {!cropMode ? (
            <button className="btn btn-secondary btn-sm" onClick={function() { setCropMode(true); setCropBox(null); }} style={{ flex: 1 }}>
              Crop
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={doCrop}
              disabled={!cropBox || cropBox.w < 20 || cropBox.h < 20}
              style={{ flex: 1 }}>
              Apply Crop
            </button>
          )}

          <label className="btn btn-secondary btn-sm" style={{ flex: 1, cursor: 'pointer', position: 'relative' }}>
            Replace
            <input type="file" accept="image/*" onChange={doReplace}
              style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
          </label>
        </div>

        {cropMode && (
          <p style={{ fontSize: 15, color: 'var(--text-light)', textAlign: 'center', marginBottom: 12 }}>
            Drag on the photo to select the area to keep.
          </p>
        )}

        <button className="btn btn-primary btn-full" onClick={doSave} style={{ fontSize: 18 }}>
          Save Photo
        </button>
      </div>
    </div>
  );
}
