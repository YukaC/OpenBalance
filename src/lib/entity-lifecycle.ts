/** Entities that support soft-delete / sync timestamps. */
export interface LifecycleFields {
  updatedAt?: string;
  deletedAt?: string | null;
}

export function isActive(entity: LifecycleFields): boolean {
  return entity.deletedAt == null;
}

export function touch<T extends LifecycleFields>(entity: T): T {
  return {
    ...entity,
    updatedAt: new Date().toISOString(),
  };
}

/** Fill missing lifecycle fields on legacy entities (rehydrate / backup import). */
export function ensureLifecycle<T extends LifecycleFields>(
  entity: T,
  nowIso: string = new Date().toISOString(),
): T & { updatedAt: string; deletedAt: string | null } {
  return {
    ...entity,
    updatedAt:
      typeof entity.updatedAt === "string" && entity.updatedAt.length > 0
        ? entity.updatedAt
        : nowIso,
    deletedAt: entity.deletedAt === undefined ? null : entity.deletedAt,
  };
}

export function activeEntities<T extends LifecycleFields>(entities: T[]): T[] {
  return entities.filter(isActive);
}
