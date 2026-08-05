import type { MediaId, VisitId } from '@/domain/shared/ids';

export type MediaKind = 'image' | 'voice';

export interface VisitMediaProps {
  id: MediaId;
  visitId: VisitId;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  blob: Blob;
}

export class VisitMedia {
  readonly id: MediaId;
  readonly visitId: VisitId;
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
  readonly blob: Blob;

  constructor(props: VisitMediaProps) {
    this.id = props.id;
    this.visitId = props.visitId;
    this.kind = props.kind;
    this.mimeType = props.mimeType;
    this.sizeBytes = props.sizeBytes;
    this.createdAt = props.createdAt;
    this.blob = props.blob;
  }

  get isImage(): boolean {
    return this.kind === 'image';
  }

  get isVoice(): boolean {
    return this.kind === 'voice';
  }
}
