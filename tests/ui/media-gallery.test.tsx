import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaGallery, type MediaItemView } from '@/ui/components/MediaGallery';

vi.mock('@/ui/media/capture-image', () => ({
  captureImage: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
}));
vi.mock('@/ui/media/use-voice-capture', () => ({
  MAX_VOICE_SECONDS: 300,
  useVoiceCapture: () => ({ status: 'idle', seconds: 0, start: vi.fn(async () => new Blob(['voz'], { type: 'audio/webm' })), stopNow: vi.fn(), cancel: vi.fn() }),
}));

const image: MediaItemView = { id: 'm1', kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['abc']) };
const voice: MediaItemView = { id: 'm2', kind: 'voice', mimeType: 'audio/webm', blob: new Blob(['voz']) };

describe('MediaGallery', () => {
  it('muestra miniatura de imagen y reproductor de voz', () => {
    render(<MediaGallery items={[image, voice]} onAdd={() => undefined} onRemove={() => undefined} />);
    expect(screen.getByAltText('Foto de la visita')).toBeInTheDocument();
    expect(document.querySelector('audio')).toBeInTheDocument();
  });

  it('agrega una foto desde el input de archivos', async () => {
    const onAdd = vi.fn();
    const { container } = render(<MediaGallery items={[]} onAdd={onAdd} onRemove={() => undefined} />);
    const input = container.querySelector('.media-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.jpg')] } });

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    const added = onAdd.mock.calls[0][0] as MediaItemView[];
    expect(added[0].kind).toBe('image');
    expect(added[0].mimeType).toBe('image/jpeg');
  });

  it('quita un item con el botón Quitar', async () => {
    const onRemove = vi.fn();
    render(<MediaGallery items={[image]} onAdd={() => undefined} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(onRemove).toHaveBeenCalledWith('m1');
  });

  it('en modo readOnly no ofrece captura ni quitar', () => {
    render(<MediaGallery readOnly items={[image]} onAdd={() => undefined} onRemove={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Foto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nota de voz' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
  });
});
