const express = require("express");
const { body, validationResult } = require("express-validator");
const { query } = require("../config/db");
const { ensureAuthenticated } = require("../middleware/auth");

const router = express.Router();

// Show the current user's CV in a private dashboard.
router.get("/dashboard", ensureAuthenticated, async (req, res, next) => {
  try {
    const rows = await query("SELECT * FROM cvs WHERE id = ?", [req.session.user.id]);
    // If the user no longer exists in DB, end the session.
    if (!rows.length) {
      req.session.destroy(() => {
        res.redirect("/login");
      });
      return;
    }

    res.render("dashboard", { cv: rows[0], csrfToken: req.csrfToken() });
  } catch (error) {
    next(error);
  }
});

// Render CV edit form for authenticated users.
router.get("/dashboard/cv/edit", ensureAuthenticated, async (req, res, next) => {
  try {
    const rows = await query("SELECT * FROM cvs WHERE id = ?", [req.session.user.id]);
    if (!rows.length) {
      return res.status(404).render("not-found", { 
        title: "CV Not Found",
        csrfToken: req.csrfToken(),
        currentUser: req.session.user || null
      });
    }

    return res.render("edit-cv", { 
      cv: rows[0], 
      errors: [],
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/dashboard/cv/edit",
  ensureAuthenticated,
  [
    // Validate editable CV fields and optional URLs.
    body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters."),
    body("keyprogramming")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 255 })
      .withMessage("Programming language must be 255 characters or fewer."),
    body("profile")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 500 })
      .withMessage("Profile must be 500 characters or fewer."),
    body("education")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 500 })
      .withMessage("Education must be 500 characters or fewer."),
    body("URLlinks")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 500 })
      .withMessage("URL links must be 500 characters or fewer.")
      .custom((value) => {
        const links = value
          .split(/[\n,]+/)
          .map((part) => part.trim())
          .filter(Boolean);

        for (const link of links) {
          try {
            const parsed = new URL(link);
            if (!["http:", "https:"].includes(parsed.protocol)) {
              return false;
            }
          } catch (error) {
            return false;
          }
        }

        return true;
      })
      .withMessage("Each URL must start with http:// or https:// and be separated by comma/new line.")
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      // Keep an in-memory representation for re-rendering on validation failures.
      const cv = {
        id: req.session.user.id,
        name: req.body.name,
        keyprogramming: req.body.keyprogramming,
        profile: req.body.profile,
        education: req.body.education,
        URLlinks: req.body.URLlinks,
        email: req.session.user.email
      };

      if (!errors.isEmpty()) {
        return res.status(400).render("edit-cv", { 
          cv, 
          errors: errors.array(),
          csrfToken: req.csrfToken()
        });
      }

      // Persist the CV updates for the currently authenticated user.
      await query(
        `
        UPDATE cvs
        SET name = ?, keyprogramming = ?, profile = ?, education = ?, URLlinks = ?
        WHERE id = ?
      `,
        [cv.name, cv.keyprogramming, cv.profile, cv.education, cv.URLlinks, cv.id]
      );

      // Keep session display name in sync with updated CV name.
      req.session.user.name = cv.name;

      return res.redirect("/dashboard");
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
