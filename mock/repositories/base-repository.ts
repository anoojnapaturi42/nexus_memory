export type RepositoryListResult<T> = Promise<T[]>;
export type RepositoryItemResult<T> = Promise<T | null>;

export interface ReadOnlyRepository<T, TId = string> {
  list(): RepositoryListResult<T>;
  getById(id: TId): RepositoryItemResult<T>;
}
