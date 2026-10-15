const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/user");
const { COOKIE_NAME } = require("../middleware/auth");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ROLES = ["recruiter", "candidate"];
const EMAIL_RE = /^[^\s@]+@([a-z0-9-]+\.)+[a-z]{2,}$/i;
const SALT_ROUNDS = 12;
const SESSION_DAYS = 7;

// Compared against when the email doesn't exist, so login takes about the same
// time whether or not the account is real (avoids leaking which emails exist).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", SALT_ROUNDS);

const isProd = process.env.NODE_ENV === "production";
const cookieBase = {
  httpOnly: true,
  secure: isProd,
  // "none" is needed when frontend and API are on different sites in production.
  sameSite: isProd ? "none" : "lax",
  path: "/",
};

// ---------- helpers ----------

// Body values must be plain strings, otherwise {"email": {"$gt": ""}} becomes a NoSQL injection.
const isString = (v) => typeof v === "string";

function startSession(res, user, status = 200) {
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(COOKIE_NAME, token, { ...cookieBase, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
  return res.status(status).json({ user: user.toPublic() });
}

function wrongRole(res, actual) {
  return res.status(403).json({ error: `This account is registered as a ${actual}.` });
}

// ---------- controllers ----------

// POST /api/auth/register  { email, password, role }
exports.register = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!isString(email) || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    // bcrypt only uses the first 72 bytes, so cap there.
    if (!isString(password) || password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: "Password must be 8-72 characters" });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: "Role must be recruiter or candidate" });
    }

    const normalized = email.trim().toLowerCase();
    if (await User.findOne({ email: normalized })) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const user = await User.create({
      email: normalized,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
      role,
      authProvider: "local",
    });

    return startSession(res, user, 201);
  } catch (err) {
    // Two simultaneous signups with the same email: the unique index catches the loser.
    if (err.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    next(err);
  }
};

// POST /api/auth/login  { email, password, role }
exports.login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!isString(email) || !isString(password) || !ROLES.includes(role)) {
      return res.status(400).json({ error: "Email, password and role are required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
    const passwordOk = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);

    if (user && !user.passwordHash) {
      return res.status(401).json({ error: "This account uses Google sign-in." });
    }
    if (!user || !passwordOk) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (user.role !== role) return wrongRole(res, user.role);

    return startSession(res, user);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/google  { credential, role }
// `credential` is the ID token the Google button gives the frontend.
// One endpoint covers both signup and login: unknown email -> account is created.
exports.googleAuth = async (req, res, next) => {
  try {
    const { credential, role } = req.body;

    if (!isString(credential) || !ROLES.includes(role)) {
      return res.status(400).json({ error: "Google credential and role are required" });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID, // rejects tokens minted for another app
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: "Invalid Google credential" });
    }

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ error: "Google account email is not verified" });
    }

    const email = payload.email.toLowerCase();
    let user =
      (await User.findOne({ googleId: payload.sub }).select("+passwordHash")) ||
      (await User.findOne({ email }).select("+passwordHash"));

    if (!user) {
      user = await User.create({
        email,
        googleId: payload.sub,
        name: payload.name,
        avatar: payload.picture,
        role,
        authProvider: "google",
      });
      return startSession(res, user, 201);
    }

    if (user.role !== role) return wrongRole(res, user.role);

    // Existing email/password account signing in with Google for the first time: link it.
    // The old password is deleted on purpose. Email/password signup doesn't verify email
    // ownership, so someone could have pre-registered this address and kept its password.
    if (!user.googleId) {
      user.googleId = payload.sub;
      user.authProvider = "google";
      user.passwordHash = undefined;
      user.name = user.name || payload.name;
      user.avatar = user.avatar || payload.picture;
      await user.save();
    }

    return startSession(res, user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Account already exists, please try again" });
    }
    next(err);
  }
};

// GET /api/auth/me   (requireAuth runs first and sets req.user)
exports.me = (req, res) => res.json({ user: req.user.toPublic() });

// POST /api/auth/logout
exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieBase);
  res.json({ message: "Logged out" });
};