// Block access to protected routes unless a session user exists.
function ensureAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  return next();
}

module.exports = {
  ensureAuthenticated
};
