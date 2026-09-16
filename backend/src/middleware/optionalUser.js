function optionalUser(req, _res, next) {
  // Allow user to directly access without any Firebase login
  req.userId = req.headers["x-user-id"] || "demo-user";
  next();
}

module.exports = { optionalUser };
