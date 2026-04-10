const { initFirebaseAdmin } = require("../auth/firebaseAdmin");

function parseCookieHeader(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

async function requireFirebaseUser(req, res, next) {
  try {
    const cookies = parseCookieHeader(req.headers.cookie || "");
    const token = cookies["firebase-session"];

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing firebase-session cookie.",
      });
    }

    const admin = initFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    req.userId = decoded.uid;
    return next();
  } catch (error) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid Firebase session token.",
      detail: error instanceof Error ? error.message : "Unknown auth error",
    });
  }
}

module.exports = {
  requireFirebaseUser,
};
