require("dotenv").config();

// Import SQL schema bootstrap file into MySQL.
const fs = require("fs/promises");
const path = require("path");
const mysql = require("mysql2/promise");

async function run() {
  // Load the root-level schema script.
  const sqlPath = path.join(process.cwd(), "cvs.sql");
  const sql = await fs.readFile(sqlPath, "utf8");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  try {
    // Execute full schema SQL (includes CREATE DATABASE / TABLE statements).
    await connection.query(sql);
    console.log("cvs.sql imported successfully.");
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("Database initialization failed:", error.message);
  process.exitCode = 1;
});
