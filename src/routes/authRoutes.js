const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const { query } = require("../config/db");

const router = express.Router();

// Render registration page.
router.get("/register", (req, res) => {
  res.render("register", { 
    errors: [], 
    formData: {},
    csrfToken: req.csrfToken()
  });
});

router.post(
  "/register",
  [
    // Basic input validation and password policy enforcement.
    body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters."),
    body("email").trim().isEmail().withMessage("Enter a valid email.").normalizeEmail(),
    body("password")
      .isLength({ min: 8, max: 64 })
      .withMessage("Password must be 8-64 characters.")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter.")
      .matches(/[a-z]/)
      .withMessage("Password must contain at least one lowercase letter.")
      .matches(/\d/)
      .withMessage("Password must contain at least one number."),
    body("confirmPassword")
      .custom((value, { req }) => value === req.body.password)
      .withMessage("Password confirmation does not match.")
  ],
  async (req, res, next) => {
    try {
      // Return form errors with previously entered fields.
      const errors = validationResult(req);
      const formData = { name: req.body.name, email: req.body.email };

      if (!errors.isEmpty()) {
        return res.status(400).render("register", { 
          errors: errors.array(), 
          formData,
          csrfToken: req.csrfToken()
        });
      }

      const existing = await query("SELECT id FROM cvs WHERE email = ?", [req.body.email]);
      if (existing.length) {
        return res.status(400).render("register", {
          errors: [{ msg: "An account with this email already exists." }],
          formData,
          csrfToken: req.csrfToken()
        });
      }

      // Hash password before storing in database.
      const hashedPassword = await bcrypt.hash(req.body.password, 12);

      await query("INSERT INTO cvs (name, email, password) VALUES (?, ?, ?)", [
        req.body.name,
        req.body.email,
        hashedPassword
      ]);

      return res.redirect("/login");
    } catch (error) {
      return next(error);
    }
  }
);

// Render login page.
router.get("/login", (req, res) => {
  res.render("login", { 
    errors: [], 
    formData: {},
    csrfToken: req.csrfToken()
  });
});

router.post(
  "/login",
  [
    // Minimal login validation.
    body("email").trim().isEmail().withMessage("Enter a valid email.").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required.")
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      const formData = { email: req.body.email };

      if (!errors.isEmpty()) {
        return res.status(400).render("login", { 
          errors: errors.array(), 
          formData,
          csrfToken: req.csrfToken()
        });
      }

      const rows = await query("SELECT * FROM cvs WHERE email = ?", [req.body.email]);
      if (!rows.length) {
        return res.status(401).render("login", {
          errors: [{ msg: "Invalid credentials." }],
          formData,
          csrfToken: req.csrfToken()
        });
      }

      // Compare provided password against stored hash.
      const user = rows[0];
      const isMatch = await bcrypt.compare(req.body.password, user.password);

      if (!isMatch) {
        return res.status(401).render("login", {
          errors: [{ msg: "Invalid credentials." }],
          formData,
          csrfToken: req.csrfToken()
        });
      }

      // Regenerate session ID on login to reduce fixation risk.
      req.session.regenerate((regenError) => {
        if (regenError) {
          return next(regenError);
        }

        req.session.user = {
          id: user.id,
          name: user.name,
          email: user.email
        };

        return res.redirect("/dashboard");
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Destroy server-side session and clear browser cookie.
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

module.exports = router;
