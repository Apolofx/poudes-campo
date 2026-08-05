import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ImagePlus, Mic, Square } from 'lucide-react';
import type { MediaKind } from '@/domain/entities/visit-media';
import { captureImage } from '@/ui/media/capture-image';
import { useVoiceCapture, MAX_VOICE_SECONDS } from '@/ui/media/use-voice-capture';

export interface MediaItemView {
  id: string;
  kind: MediaKind;
  mimeType: string;
  blob: Blob;
}

interface MediaGalleryProps {
  items: MediaItemView[];
  onAdd: (items: MediaItemView[]) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  readOnly?: boolean;
  busy?: boolean;
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RING_R = 15.9;
const RING_C = 2 * Math.PI * RING_R;

export function MediaGallery({ items, onAdd, onRemove, readOnly = false, busy = false }: MediaGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceCapture();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [imageError, setImageError] = useState<string | undefined>();
  const [voiceError, setVoiceError] = useState<string | undefined>();
  const [startingVoice, setStartingVoice] = useState(false);

  useEffect(() => {
    const created: string[] = [];
    const next: Record<string, string> = {};
    for (const item of items) {
      const url = URL.createObjectURL(item.blob);
      next[item.id] = url;
      created.push(url);
    }
    setUrls(next);
    return () => { created.forEach((u) => URL.revokeObjectURL(u)); };
  }, [items]);

  const onFiles = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setImageError(undefined);
    if (files.length === 0) return;
    const captured: MediaItemView[] = [];
    for (const file of files) {
      try {
        const blob = await captureImage(file);
        captured.push({ id: crypto.randomUUID(), kind: 'image', mimeType: 'image/jpeg', blob });
      } catch {
        setImageError('No se pudo procesar la imagen.');
      }
    }
    if (captured.length > 0) await onAdd(captured);
  }, [onAdd]);

  const startVoice = useCallback(async () => {
    setVoiceError(undefined);
    setStartingVoice(true);
    const session = voice.start();
    const blob = await session;
    setStartingVoice(false);
    if (blob) {
      await onAdd([{ id: crypto.randomUUID(), kind: 'voice', mimeType: blob.type || 'audio/webm', blob }]);
    } else {
      setVoiceError('No se pudo acceder al micrófono.');
    }
  }, [voice, onAdd]);

  const stopVoice = useCallback(() => voice.stopNow(), [voice]);

  const recording = voice.status === 'recording';
  const canCapture = !readOnly && !busy && !startingVoice && !recording;
  const ringProgress = Math.min(1, voice.seconds / MAX_VOICE_SECONDS);

  return (
    <>
      {!readOnly && (
        <div className="media-capture" role="group" aria-label="Agregar fotos o nota de voz">
          <input ref={fileInputRef} className="media-file-input" type="file" accept="image/*" multiple onChange={onFiles} />
          <button
            type="button"
            className="capture-btn"
            disabled={!canCapture}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="capture-icon">
              <ImagePlus size={22} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="capture-label">Foto</span>
          </button>
          {recording ? (
            <button
              type="button"
              className="capture-btn is-recording"
              aria-label={`Detener · ${formatSeconds(voice.seconds)}`}
              onClick={stopVoice}
            >
              <span className="capture-icon">
                <svg className="capture-ring" viewBox="0 0 36 36" aria-hidden="true">
                  <circle className="capture-ring-track" cx="18" cy="18" r={RING_R} />
                  <circle
                    className="capture-ring-fill"
                    cx="18"
                    cy="18"
                    r={RING_R}
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - ringProgress)}
                  />
                </svg>
                <Square size={18} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
              </span>
              <span className="capture-label">{formatSeconds(voice.seconds)}</span>
            </button>
          ) : (
            <button type="button" className="capture-btn" disabled={!canCapture} onClick={() => void startVoice()}>
              <span className="capture-icon">
                <Mic size={22} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="capture-label">Nota de voz</span>
            </button>
          )}
        </div>
      )}
      {items.length > 0 && (
        <ul className="media-list">
          {items.map((item) => (
            <li key={item.id} className="media-item">
              {item.kind === 'image' ? (
                <img className="media-thumb" src={urls[item.id]} alt="Foto de la visita" />
              ) : (
                <audio className="media-audio" controls src={urls[item.id]} />
              )}
              <div className="media-actions">
                <span className="media-meta">{item.kind === 'image' ? 'Foto' : 'Nota de voz'}</span>
                {!readOnly && (
                  <button type="button" className="btn-remove" onClick={() => onRemove(item.id)}>
                    Quitar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {imageError && <p className="alert" role="alert">{imageError}</p>}
      {voiceError && <p className="alert" role="alert">{voiceError}</p>}
    </>
  );
}
