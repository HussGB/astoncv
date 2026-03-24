require("dotenv").config();

// Lightweight DB diagnostic script.
const mysql = require("mysql2/promise");

async function run() {
  // Connect directly using the environment credentials.
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    await connection.execute("SELECT 1");
    // Confirm that the expected application table exists.
    const [rows] = await connection.execute("SHOW TABLES LIKE 'cvs'");

    if (rows.length) {
      console.log("Database connection successful and table 'cvs' exists.");
    } else {
      console.log("Database connection successful, but table 'cvs' is missing.");
      process.exitCode = 2;
    }
  } finally {
    // Always close DB connection, including on errors.
    await connection.end();
  }
}

run().catch((error) => {
  console.error("Database check failed:", error.message);
  process.exitCode = 1;
});
