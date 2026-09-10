export class InvalidExportFormat extends Error {
  constructor() {
    super('invalid export file format');
    this.name = 'InvalidExportFormat';
  }
}

export class UnsupportedExportVersion extends Error {
  constructor(readonly version: number | undefined) {
    super(`unsupported export version: ${version === undefined ? 'missing' : version}`);
    this.name = 'UnsupportedExportVersion';
  }
}