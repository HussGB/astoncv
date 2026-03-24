require("dotenv").config();

// Import sample rows for local/demo usage.
const fs = require("fs/promises");
const path = require("path");
const mysql = require("mysql2/promise");

async function run() {
  // Load seed SQL from the project root.
  const sqlPath = path.join(process.cwd(), "seed-sample-data.sql");
  const sql = await fs.readFile(sqlPath, "utf8");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  try {
    // Insert sample data and report current table size.
    await connection.query(sql);
    const [rows] = await connection.execute("SELECT COUNT(*) AS total FROM cvs");
    console.log(`Sample data imported. Current cvs row count: ${rows[0].total}`);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("Sample data import failed:", error.message);
  process.exitCode = 1;
});
