export type SqlQuery = {
  text: string;
  values: unknown[];
};

export function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function buildSelectByIdQuery(tableName: string, id: string): SqlQuery {
  return {
    text: `select * from ${quoteIdentifier(tableName)} where id = $1 limit 1`,
    values: [id],
  };
}

export function buildSelectByColumnQuery(
  tableName: string,
  columnName: string,
  value: unknown,
  options?: { limit?: number; offset?: number; orderBy?: string },
): SqlQuery {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const orderBy = options?.orderBy ?? "created_at desc";

  return {
    text: `select * from ${quoteIdentifier(tableName)} where ${quoteIdentifier(columnName)} = $1 order by ${orderBy} limit $2 offset $3`,
    values: [value, limit, offset],
  };
}

export function buildListQuery(tableName: string, options?: { limit?: number; offset?: number; orderBy?: string }): SqlQuery {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const orderBy = options?.orderBy ?? "created_at desc";

  return {
    text: `select * from ${quoteIdentifier(tableName)} order by ${orderBy} limit $1 offset $2`,
    values: [limit, offset],
  };
}

export function buildInsertQuery(tableName: string, payload: Record<string, unknown>): SqlQuery {
  const columns = Object.keys(payload);
  const values = Object.values(payload);
  const text = [
    `insert into ${quoteIdentifier(tableName)}`,
    `(${columns.map((column) => quoteIdentifier(column)).join(", ")})`,
    `values (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
    "returning *",
  ].join(" ");

  return { text, values };
}

export function buildUpdateQuery(tableName: string, id: string, payload: Record<string, unknown>): SqlQuery {
  const columns = Object.keys(payload);
  const values = Object.values(payload);
  const assignments = columns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(", ");

  return {
    text: `update ${quoteIdentifier(tableName)} set ${assignments} where id = $${columns.length + 1} returning *`,
    values: [...values, id],
  };
}

export function buildDeleteQuery(tableName: string, id: string): SqlQuery {
  return {
    text: `delete from ${quoteIdentifier(tableName)} where id = $1 returning id`,
    values: [id],
  };
}

export function toPgVectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}
