export interface CatalogEntity {
  id: string;
  name: string;
  archived: boolean;
}

export interface CatalogSectionLabels {
  listTitle: string; // "Zonas"
  newAction: string; // "Nueva zona"
  formTitleNew: string; // "Nueva zona"
  formTitleEdit: string; // "Editar zona"
  backToList: string; // "Zonas"
  emptyMessage: string; // "No hay zonas."
  cascadeTitle: (name: string) => string; // `Archivar ${name}`
  cascadeMessage: (count: number) => string; // `Esta zona tiene ${count} lotes activos. ¿Archivar también los lotes?`
}

export interface CatalogSectionActions<E extends CatalogEntity> {
  list: () => Promise<E[]>;
  create: (name: string) => Promise<unknown>;
  rename: (id: string, name: string) => Promise<unknown>;
  archive: (id: string, cascadeFields: boolean) => Promise<void>;
  restore: (id: string) => Promise<void>;
  countActiveFields: (id: string) => Promise<number>;
}

export interface CatalogSection<E extends CatalogEntity> {
  basePath: string; // '/catalogo/zonas'
  newPath: string; // '/catalogo/zonas/nueva'
  labels: CatalogSectionLabels;
  actions: CatalogSectionActions<E>;
}
