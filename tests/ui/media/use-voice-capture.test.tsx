import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useVoiceCapture, MAX_VOICE_SECONDS } from '@/ui/media/use-voice-capture';

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  chunks: Blob[] = [];
  start(): void { this.state = 'recording'; }
  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voz'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

let windowBlob: Blob | null = null;
const stopTrack = vi.fn();

function Probe() {
  const voice = useVoiceCapture();
  return (
    <div>
      <span data-testid="status">{voice.status}</span>
      <span data-testid="seconds">{voice.seconds}</span>
      <button onClick={() => { void voice.start().then((b) => { windowBlob = b; }); }}>start</button>
      <button onClick={() => voice.stopNow()}>stop</button>
    </div>
  );
}

describe('useVoiceCapture', () => {
  beforeEach(() => {
    windowBlob = null;
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pasa por idle → recording → done y resuelve el blob al detener', async () => {
    render(<Probe />);
    await userEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('recording'));

    await userEvent.click(screen.getByRole('button', { name: 'stop' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('done'));
    await waitFor(() => expect(windowBlob).not.toBeNull());
    expect(await readBlobText(windowBlob!)).toBe('voz');
  });

  it('detiene solo a los 5 minutos si nadie lo frena (auto-stop)', async () => {
    vi.useFakeTimers();
    try {
      render(<Probe />);
      fireEvent.click(screen.getByRole('button', { name: 'start' }));
      await vi.waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('recording'));

      vi.advanceTimersByTime(MAX_VOICE_SECONDS * 1000);

      await vi.waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('done'));
      expect(windowBlob).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
