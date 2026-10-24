// Tiny compatibility translator for the existing BytePets SQLite-domain SQL.
// All interpolation stays parameterised. Only SQL from our trusted server is accepted.
export function postgresSql(sql) {
  let n = 0;
  const replaced = sql.replace(/('(?:''|[^'])*')|\?/g, (match, literal) => {
    if (literal) return literal;
    return `$${++n}`;
  });
  let statement = replaced.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
  if (/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql)) statement += ' ON CONFLICT DO NOTHING';
  statement = statement.replace(/\bMIN\s*\(\s*(\d+)\s*,/gi, 'LEAST($1,');
  return statement;
}
export const pgRow = row => row;
