require("dotenv").config();

// Core Node/Express dependencies and shared resources.
const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const csurf = require("csurf");
const rateLimit = require("express-rate-limit");
const { pool } = require("./config/db");

const publicRoutes = require("./routes/publicRoutes");
const authRoutes = require("./routes/authRoutes");
const cvRoutes = require("./routes/cvRoutes");

// Express app initialization and environment flags.
const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Enable reverse proxy awareness when deployed behind Apache/Nginx.
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// View engine and template directory.
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Security headers via Helmet with a strict in-app CSP policy.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"]
      }
    }
  })
);

// Parse form bodies and serve static assets.
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// Session configuration for authenticated areas.
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_fallback_secret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 4
    }
  })
);

// Limit repeated login/register attempts.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many authentication attempts. Please try again in a few minutes."
});

app.use(["/login", "/register"], authLimiter);

// Baseline rate limiting for all remaining routes.
app.use(
  "/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(csurf());
// CSRF protection for all state-changing forms.

app.use((req, res, next) => {
// Common template locals available in every rendered view.
  res.locals.csrfToken = req.csrfToken();
  res.locals.currentUser = req.session.user || null;
  next();
});

app.use(publicRoutes);
// Route modules.
app.use(authRoutes);
app.use(cvRoutes);

app.use((req, res) => {
// 404 fallback.
  res.status(404).render("not-found", {
    title: "Page Not Found",
    csrfToken: res.locals.csrfToken,
    currentUser: res.locals.currentUser
  });
});

// Centralized error handling for security and database failures.
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).render("error", {
      title: "Security Error",
      message: "Invalid form token. Please try submitting the form again.",
      csrfToken: res.locals.csrfToken,
      currentUser: res.locals.currentUser
    });
  }

  if (err && err.code === "ECONNREFUSED") {
    return res.status(500).render("error", {
      title: "Database Offline",
      message: "The app cannot connect to MySQL yet. Configure MySQL and .env, then restart.",
      csrfToken: res.locals.csrfToken,
      currentUser: res.locals.currentUser
    });
  }

  if (err && err.code === "ER_ACCESS_DENIED_ERROR") {
    return res.status(500).render("error", {
      title: "Database Login Error",
      message: "MySQL username/password is rejected. Check your .env values and restart.",
      csrfToken: res.locals.csrfToken,
      currentUser: res.locals.currentUser
    });
  }

  if (err && err.code === "ER_BAD_DB_ERROR") {
    return res.status(500).render("error", {
      title: "Database Missing",
      message: "Database not found. Import cvs.sql and verify DB_NAME in .env.",
      csrfToken: res.locals.csrfToken,
      currentUser: res.locals.currentUser
    });
  }

  if (err && err.code === "ER_NO_SUCH_TABLE") {
    return res.status(500).render("error", {
      title: "Table Missing",
      message: "Table 'cvs' does not exist yet. Run npm run db:init to import cvs.sql.",
      csrfToken: res.locals.csrfToken,
      currentUser: res.locals.currentUser
    });
  }

  console.error(err);
  return res.status(500).render("error", {
    title: "Server Error",
    message: "Something went wrong. Please try again later.",
    csrfToken: res.locals.csrfToken,
    currentUser: res.locals.currentUser
  });
});

// Server startup and a lightweight DB connectivity check.
const port = Number(process.env.PORT || 3750);
app.set('trust proxy', 1); // trust first proxy (Apache/Nginx)
app.use(express.static('public'))
app.listen(port, async () => {
  try {
    await pool.query("SELECT 1");
    console.log(`AstonCV running on http://localhost:${port} (MySQL connected)`);
  } catch (error) {
    console.log(`AstonCV running on http://localhost:${port} (MySQL not connected yet)`);
  }
});
