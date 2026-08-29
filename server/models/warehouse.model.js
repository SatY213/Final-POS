const db = require("../config/database");

function create(data) {
  const {
    name,
    phone,
    email,
    nif,
    nis,
    tax_article,
    commercial_register,
    address,
    business_activity,
    can_sell = 1,
    is_active = 1,
  } = data;

  const result = db
    .prepare(
      `
      INSERT INTO warehouses (
        name,
        phone,
        email,
        nif,
        nis,
        tax_article,
        commercial_register,
        address,
        business_activity,
        can_sell,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      name,
      phone || null,
      email || null,
      nif || null,
      nis || null,
      tax_article || null,
      commercial_register || null,
      address || null,
      business_activity || null,
      can_sell ? 1 : 0,
      is_active ? 1 : 0,
    );

  return findById(result.lastInsertRowid);
}

function findAll() {
  return db
    .prepare(
      `
      SELECT
        id,
        name,
        phone,
        email,
        nif,
        nis,
        tax_article,
        commercial_register,
        address,
        business_activity,
        can_sell,
        is_active,
        created_at
      FROM warehouses
      ORDER BY name ASC
    `,
    )
    .all();
}

function findById(id) {
  return db
    .prepare(
      `
      SELECT
        id,
        name,
        phone,
        email,
        nif,
        nis,
        tax_article,
        commercial_register,
        address,
        business_activity,
        can_sell,
        is_active,
        created_at
      FROM warehouses
      WHERE id = ?
    `,
    )
    .get(id);
}

function update(id, data) {
  const {
    name,
    phone,
    email,
    nif,
    nis,
    tax_article,
    commercial_register,
    address,
    business_activity,
    can_sell,
    is_active,
  } = data;

  const result = db
    .prepare(
      `
      UPDATE warehouses
      SET
        name = ?,
        phone = ?,
        email = ?,
        nif = ?,
        nis = ?,
        tax_article = ?,
        commercial_register = ?,
        address = ?,
        business_activity = ?,
        can_sell = ?,
        is_active = ?
      WHERE id = ?
    `,
    )
    .run(
      name,
      phone || null,
      email || null,
      nif || null,
      nis || null,
      tax_article || null,
      commercial_register || null,
      address || null,
      business_activity || null,
      can_sell ? 1 : 0,
      is_active ? 1 : 0,
      id,
    );

  if (result.changes === 0) {
    return null;
  }

  return findById(id);
}

module.exports = {
  create,
  findAll,
  findById,
  update,
};
