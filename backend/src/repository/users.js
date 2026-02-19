import pool from "../database.js";

export async function findAll(client = pool) {
  const { rows } = await client.query("SELECT * FROM users ORDER BY id ASC");
  return rows;
}

export async function findById(id, client = pool) {
  const { rows } = await client.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function insert({ name, email }, client = pool) {
  const { rows } = await client.query(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
    [name, email]
  );
  return rows[0];
}

export async function update(id, { name, email }, client = pool) {
  const { rows } = await client.query(
    "UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *",
    [name, email, id]
  );
  return rows[0] ?? null;
}

export async function remove(id, client = pool) {
  const { rowCount } = await client.query("DELETE FROM users WHERE id = $1", [id]);
  return rowCount > 0;
}
