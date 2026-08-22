import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

// Full-size, uncropped photo viewer with a thumbnail strip — the counterpart
// to every small object-cover gallery thumbnail in the app, which always
// crops. Shared by the marketplace and animal profile so "click a photo" and
// "see everything, at full size" behaves the same everywhere.
export default function Lightbox({ photos, index, onClose, onIndexChange, alt }) {
  const go = useCallback((dir) => {
    if (!photos || photos.length === 0) return;
    onIndexChange((index + dir + photos.length) % photos.length);
  }, [photos, index, onIndexChange]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, go]);

  if (!photos || photos.length === 0 || index == null) return null;

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/90 flex flex-col items-center justify-center p-4 sm:p-8"
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label={alt || 'Photo viewer'}
    >
      <button
        type="button" onClick={onClose} aria-label="Close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
      >
        <X size={20} />
      </button>

      {photos.length > 1 && (
        <span className="absolute top-4 left-4 text-white/70 text-xs font-black uppercase tracking-widest">
          {index + 1} / {photos.length}
        </span>
      )}

      <div className="relative w-full max-w-4xl flex-1 flex items-center justify-center min-h-0" onClick={e => e.stopPropagation()}>
        {photos.length > 1 && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo"
            className="absolute left-0 sm:-left-14 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition z-10">
            <ChevronLeft size={22} />
          </button>
        )}
        <img
          src={photos[index]} alt={alt}
          className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
        />
        {photos.length > 1 && (
          <button type="button" onClick={() => go(1)} aria-label="Next photo"
            className="absolute right-0 sm:-right-14 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition z-10">
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 mt-4 overflow-x-auto max-w-full px-2" onClick={e => e.stopPropagation()}>
          {photos.map((url, i) => (
            <button
              key={url + i} type="button" onClick={() => onIndexChange(i)}
              className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition ${i === index ? 'border-white' : 'border-transparent opacity-50 hover:opacity-80'}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
