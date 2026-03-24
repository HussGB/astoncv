const express = require("express");
const { query } = require("../config/db");

const router = express.Router();

// Public directory page with optional search filter.
router.get("/", async (req, res, next) => {
  try {
    // Limit search query length defensively.
    const q = (req.query.q || "").trim().slice(0, 100);
    let sql = "SELECT id, name, email, keyprogramming FROM cvs ORDER BY id DESC";
    let params = [];

    if (q) {
      sql = `
        SELECT id, name, email, keyprogramming
        FROM cvs
        WHERE name LIKE ? OR keyprogramming LIKE ?
        ORDER BY id DESC
      `;
      const like = `%${q}%`;
      params = [like, like];
    }

    const cvs = await query(sql, params);
    res.render("index", { cvs, q, csrfToken: req.csrfToken() });
  } catch (error) {
    next(error);
  }
});

// Public CV detail page by numeric ID.
router.get("/cvs/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).render("error", {
        title: "Invalid CV ID",
        message: "The requested CV id is not valid.",
        csrfToken: req.csrfToken(),
        currentUser: req.session.user || null
      });
    }

    const rows = await query("SELECT * FROM cvs WHERE id = ?", [id]);

    if (!rows.length) {
      return res.status(404).render("not-found", { 
        title: "CV Not Found",
        csrfToken: req.csrfToken(),
        currentUser: req.session.user || null
      });
    }

    return res.render("cv-detail", { 
      cv: rows[0],
      csrfToken: req.csrfToken(),
      currentUser: req.session.user || null
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
