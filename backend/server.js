const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const crypto = require('crypto');
const User = require('./models/User');
const PendingSignup = require('./models/PendingSignup');
const TailorProfile = require('./models/TailorProfile');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const Order = require('./models/Order');
const Testimonial = require('./models/Testimonial');
const { sendMailSafe, sendOtpMail, getMailFrom, verifySmtpOnStartup, OTP_EMAIL_FAIL_MESSAGE } =
  require('./email/mailer');
const { makeWelcomeEmail } = require('./email/templates/welcomeEmail');

const app = express();
const PORT = 5000;
const server = http.createServer(app);
const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function corsOrigin(origin, callback) {
  if (!IS_PRODUCTION) {
    return callback(null, true);
  }
  if (!origin) {
    return callback(null, true);
  }
  if (ALLOWED_ORIGINS.includes(origin)) {
    return callback(null, true);
  }
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return callback(null, origin);
    }
  } catch {
    // ignore
  }
  return callback(new Error('Not allowed by CORS'));
}

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
});

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

// --- Auth: stateless signed session cookie (no new deps) ---
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'sewserve_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
const SESSION_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.SESSION_TTL_MS) || 1000 * 60 * 60 * 24 * 7); // 7d
const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
const PENDING_SIGNUP_TTL_MS = 15 * 60 * 1000;
const OTP_SIGNUP_EMAIL_FAIL_MSG = 'OTP email failed to send. Please try again.';

function generateSixDigitOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashEmailOtp(email, otp) {
  const em = String(email || '')
    .trim()
    .toLowerCase();
  const code = String(otp || '').trim();
  return crypto.createHmac('sha256', SESSION_SECRET).update(`${em}:${code}`).digest('hex');
}

function buildSignupPayload(body, role, file) {
  const payload = {
    experience: String(body.experience || '').trim(),
  };
  if (role !== 'tailor') return payload;

  const latRaw = body.lat != null ? String(body.lat).trim() : '';
  const lngRaw = body.lng != null ? String(body.lng).trim() : '';
  let lat = latRaw !== '' ? Number(latRaw) : NaN;
  let lng = lngRaw !== '' ? Number(lngRaw) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = 0;
    lng = 0;
  }

  return {
    ...payload,
    shopName: String(body.shopName || '').trim(),
    city: String(body.city || '').trim(),
    specialty: String(body.specialty || '').trim(),
    lat,
    lng,
    experienceYears: Math.max(0, parseInt(String(body.experienceYears || '0'), 10) || 0),
    priceStart: Math.max(0, parseInt(String(body.priceStart || '1500'), 10) || 1500),
    deliveryDays: Math.max(1, parseInt(String(body.deliveryDays || '7'), 10) || 7),
    bio: String(body.bio || '').trim(),
    imageUrl: file ? `/uploads/${file.filename}` : String(body.imageUrl || '').trim(),
  };
}

async function removeStaleUnverifiedUserIfAny(normalizedEmail) {
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (!existingUser) return;
  if (existingUser.isVerified === true) return;
  console.log('[register] removing stale unverified user email=%s id=%s', normalizedEmail, existingUser.id);
  await rollbackRegisteredUser(existingUser, existingUser.role || 'customer');
}

async function assignOtpToPendingAndSend(pending, purpose) {
  const otp = generateSixDigitOtp();
  pending.otpHash = hashEmailOtp(pending.email, otp);
  pending.otpExpiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);
  await pending.save();
  await sendOtpMail({
    to: pending.email,
    otp,
    purpose,
    name: pending.fullName,
    expiresMinutes: Math.floor(EMAIL_OTP_TTL_MS / 60000),
  });
}

function base64UrlEncode(input) {
  return Buffer.from(String(input), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecodeToString(input) {
  const s = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, 'base64').toString('utf8');
}

function timingSafeEqualStr(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function parseCookies(req) {
  const header = req && req.headers ? req.headers.cookie : '';
  const out = {};
  if (!header) return out;
  const parts = String(header).split(';');
  for (const part of parts) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function signSessionPayload(payloadObj) {
  const payloadB64 = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifySessionToken(token) {
  const raw = String(token || '').trim();
  const [payloadB64, sig] = raw.split('.');
  if (!payloadB64 || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  if (!timingSafeEqualStr(sig, expected)) return null;
  try {
    const json = base64UrlDecodeToString(payloadB64);
    const payload = JSON.parse(json);
    if (!payload || typeof payload !== 'object') return null;
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function setSessionCookie(res, user) {
  const now = Date.now();
  const payload = {
    uid: user && user.id != null ? Number(user.id) : null,
    email: user && user.email != null ? String(user.email).trim().toLowerCase() : '',
    role: user && user.role != null ? String(user.role) : '',
    exp: now + SESSION_TTL_MS,
    iat: now,
  };
  const token = signSessionPayload(payload);
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (IS_PRODUCTION) cookieParts.push('Secure');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearSessionCookie(res) {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (IS_PRODUCTION) cookieParts.push('Secure');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

async function loadAuthedUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  const payload = verifySessionToken(token);
  if (!payload || !payload.uid || !payload.email) return null;
  const user = await User.findOne({ id: Number(payload.uid), email: String(payload.email) }).lean();
  if (!user) return null;
  if (user.isVerified !== true) return null;
  const role = user.role || 'customer';
  // Role drift check (token role must match DB role if present)
  if (payload.role && String(payload.role) !== String(role)) return null;
  let tailorShopId = null;
  let tp = null;
  if (role === 'tailor') {
    tp = await TailorProfile.findOne({ userId: user.id })
      .select('tailorShopId location published')
      .lean();
    if (tp && tp.tailorShopId) tailorShopId = String(tp.tailorShopId).trim();
  }
  const profileComplete = resolveTailorProfileComplete(user, tp);
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role,
    profileComplete,
    ...(tailorShopId ? { tailorShopId } : {}),
  };
}

function normalizeAuthId(value) {
  if (value == null) return '';
  return String(value).trim();
}

function authIdsMatch(a, b) {
  const sa = normalizeAuthId(a);
  const sb = normalizeAuthId(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const na = Number(sa);
  const nb = Number(sb);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na === nb) return true;
  return false;
}

/** True when the logged-in customer owns this order (numeric + body snapshot fallback). */
function customerOwnsOrder(req, orderCustomerId, body = {}) {
  if (!req.authUser || req.authUser.role !== 'customer') return false;
  const authId = normalizeAuthId(req.authUser.id);
  const orderCid = normalizeAuthId(orderCustomerId);
  const bodyCid = body && body.customerId != null ? normalizeAuthId(body.customerId) : '';
  if (authIdsMatch(orderCid, authId)) return true;
  if (bodyCid && authIdsMatch(bodyCid, authId)) return true;
  return false;
}

function tailorShopFromAuth(req) {
  return req.authUser && req.authUser.tailorShopId != null
    ? normalizeAuthId(req.authUser.tailorShopId)
    : '';
}

async function resolveTailorShopId(req) {
  if (req._resolvedTailorShopId !== undefined) return req._resolvedTailorShopId;
  let shop = tailorShopFromAuth(req);
  if (!shop && req.authUser && req.authUser.role === 'tailor') {
    try {
      const tp = await TailorProfile.findOne({ userId: req.authUser.id }).select('tailorShopId').lean();
      if (tp && tp.tailorShopId) shop = normalizeAuthId(tp.tailorShopId);
    } catch (e) {
      console.error('[auth] resolveTailorShopId', e);
    }
  }
  req._resolvedTailorShopId = shop || '';
  return req._resolvedTailorShopId;
}

/**
 * Tailor PATCH authorization: assigned shop, or explicit accept/claim on unassigned — never steal.
 */
function tailorMayPatchOrder(req, existingDoc, body, tailorPatch) {
  const shop = tailorShopFromAuth(req);
  if (!shop) return { ok: false, reason: 'no_tailor_shop' };
  const orderTid = normalizeId(existingDoc?.tailorId);
  const bodyTailor = body.tailorId != null ? normalizeId(body.tailorId) : '';
  const explicitClaim = Boolean(tailorPatch && tailorPatch.explicitClaim);

  if (orderTid && orderTid === shop) return { ok: true, kind: 'assigned' };

  if (explicitClaim) {
    if (orderTid && isRealTailorId(orderTid) && orderTid !== shop) {
      return { ok: false, reason: 'other_tailor', orderTailorId: orderTid, loggedTailorId: shop };
    }
    if (bodyTailor === shop || !orderTid || isPlaceholderTailorIdForClaim(orderTid)) {
      return { ok: true, kind: 'claim' };
    }
    return { ok: false, reason: 'claim_mismatch', orderTailorId: orderTid, loggedTailorId: shop };
  }

  if (!orderTid || isPlaceholderTailorIdForClaim(orderTid)) {
    return { ok: false, reason: 'unassigned' };
  }

  return { ok: false, reason: 'other_tailor', orderTailorId: orderTid, loggedTailorId: shop };
}

function log403PatchOrder(req, existingDoc, body, extra = {}) {
  console.warn('[403 PATCH order]', {
    authUserId: normalizeAuthId(req.authUser && req.authUser.id),
    authRole: req.authUser && req.authUser.role,
    authTailorShopId: tailorShopFromAuth(req),
    orderCustomerId: normalizeAuthId(existingDoc && existingDoc.customerId),
    orderTailorId: normalizeAuthId(existingDoc && existingDoc.tailorId),
    incomingTailorId: body && body.tailorId != null ? normalizeAuthId(body.tailorId) : '',
    action: body && body.action,
    path: req.path,
    ...extra,
  });
}

function log403Conversations(req, type, paramId, extra = {}) {
  console.warn('[403 conversations]', {
    type,
    paramId: normalizeAuthId(paramId),
    authUserId: normalizeAuthId(req.authUser && req.authUser.id),
    authTailorId: tailorShopFromAuth(req),
    path: req.path,
    ...extra,
  });
}

function log403AcceptOrder(orderId, orderTailorId, loggedTailorId, incomingTailorId) {
  log403Details(null, {
    endpoint: 'accept_order',
    orderId,
    orderTailorId,
    loggedTailorId,
    incomingTailorId,
  });
}

/** Unified 403 diagnostic log (req optional for socket-only paths). */
function log403Details(req, fields = {}) {
  const authUser = req && req.authUser ? req.authUser : null;
  console.warn('[403 details]', {
    endpoint: (req && req.path) || fields.endpoint || '',
    action: (req && req.body && req.body.action) || fields.action,
    authUserId: normalizeAuthId(authUser && authUser.id),
    authTailorId: tailorShopFromAuth(req || { authUser }),
    customerId: fields.customerId,
    tailorId: fields.tailorId,
    orderCustomerId: fields.orderCustomerId,
    orderTailorId: fields.orderTailorId,
    conversationId: fields.conversationId,
    ...fields,
  });
}

/** Express 5 router waits on returned Promises; the old `void async IIFE` pattern can race ahead of `next()`. */
async function requireAuth(req, res, next) {
  try {
    const u = await loadAuthedUser(req);
    if (!u) {
      clearSessionCookie(res);
      res.status(401).json({ message: 'Not authenticated.' });
      return;
    }
    req.authUser = u;
    next();
  } catch (e) {
    console.error('[auth] requireAuth error', e);
    clearSessionCookie(res);
    res.status(401).json({ message: 'Not authenticated.' });
  }
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [];
  return (req, res, next) => {
    const role = req.authUser && req.authUser.role ? String(req.authUser.role) : '';
    if (!role || (allowed.length && !allowed.includes(role))) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    return next();
  };
}

const uploadsDir = path.join(__dirname, 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch {
  // ignore
}

app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const safe = String(file.originalname || 'upload').replace(/[^\w.\-]+/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
});

mongoose
  .connect('mongodb://127.0.0.1:27017/sewserve')
  .then(async () => {
    console.log('DB CONNECTED');
    // Do NOT auto-verify users without OTP — that blocks the email verification flow.
    // Dev/manual Mongo cleanup if testing is blocked by stale accounts:
    //   db.users.deleteMany({ isVerified: false })
    //   db.pendingsignups.deleteMany({})
    // Verified users (isVerified: true) remain registered and block duplicate signup.
  })
  .catch((error) => {
    console.error('DB CONNECTION FAILED', error);
  });

app.get('/', (req, res) => {
  res.send('Server is running!');
});
app.get('/test', (req, res) => {
    res.send('TEST WORKING');
  });

// Optional email verification (NOT enforced on login; safe to add).
app.get('/api/verify-email', async (req, res) => {
  try {
    const token = req.query.token != null ? String(req.query.token).trim() : '';
    if (!token) return res.status(400).json({ message: 'Missing token.' });

    const user = await User.findOne({
      emailVerifyToken: token,
      emailVerifyTokenExpiresAt: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });

    user.emailVerified = true;
    user.isVerified = true;
    user.emailVerifyToken = '';
    user.emailVerifyTokenExpiresAt = null;
    user.emailOtpHash = '';
    user.emailOtpExpiresAt = null;
    await user.save();
    return res.status(200).json({ message: 'Email verified successfully.' });
  } catch (e) {
    console.error('VERIFY EMAIL ERROR', e);
    return res.status(500).json({ message: 'Could not verify email.' });
  }
});

// NOTE: Do not inject a static default image here.
// The frontend will generate unique UI Avatars when `imageUrl` is missing.

function mapTailorProfileToPublicRow(doc, idx = 0) {
  const d = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
  if (!d) return null;
  const priceStart = Math.max(0, Number(d.priceStart) || 0);
  const coords =
    d.location && d.location.type === 'Point' && Array.isArray(d.location.coordinates)
      ? d.location.coordinates
      : null;
  const lng = coords && coords.length >= 2 ? Number(coords[0]) : null;
  const lat = coords && coords.length >= 2 ? Number(coords[1]) : null;
  return {
    id: String(d._id),
    tailorShopId: d.tailorShopId,
    name: d.shopName || d.displayName || 'Tailor',
    city: d.city,
    specialty: d.specialty,
    rating: Math.min(5, Math.max(0, Number(d.rating) || 4.7)),
    experienceYears: Math.max(0, Number(d.experienceYears) || 0),
    distanceKm: Number((2 + (idx % 8) * 0.35).toFixed(1)),
    availability: d.availability === 'busy' ? 'busy' : 'available',
    priceLabel: `Starting from PKR ${Math.round(priceStart).toLocaleString('en-PK')}`,
    priceStart,
    deliveryDays: Math.max(1, Number(d.deliveryDays) || 7),
    imageUrl: (d.imageUrl && String(d.imageUrl).trim()) || '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    bio: d.bio || '',
    skillsNotes: d.skillsNotes || '',
  };
}

function isMongoDuplicateKeyError(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

/** Next numeric User.id — avoids countDocuments gaps when users were deleted but tailor profiles remain. */
async function allocateNextNumericUserId() {
  const [userAgg, tpAgg] = await Promise.all([
    User.aggregate([{ $group: { _id: null, maxId: { $max: '$id' } } }]).exec(),
    TailorProfile.aggregate([{ $group: { _id: null, maxId: { $max: '$userId' } } }]).exec(),
  ]);
  const maxUserId = userAgg[0]?.maxId ?? 0;
  const maxProfileUserId = tpAgg[0]?.maxId ?? 0;
  let candidate = Math.max(maxUserId, maxProfileUserId) + 1;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [userTaken, profileTaken] = await Promise.all([
      User.exists({ id: candidate }),
      TailorProfile.exists({ userId: candidate }),
    ]);
    if (!userTaken && !profileTaken) return candidate;
    candidate += 1;
  }
  throw new Error('Could not allocate a unique numeric user id');
}

async function rollbackRegisteredUser(userDoc, role) {
  if (!userDoc?._id) return;
  const numericId = userDoc.id;
  if (role === 'tailor' && numericId != null) {
    await TailorProfile.deleteOne({ userId: numericId }).catch(() => {});
  }
  await User.deleteOne({ _id: userDoc._id }).catch(() => {});
}

async function registerUser(req, res) {
  const body = req.body || {};

  console.log('BODY RECEIVED:', body);
  console.log('FILE RECEIVED:', req.file);

  const fullName = String(body.fullName || body.name || '').trim();
  const email = String(body.email || '').trim();
  const password = String(body.password || '').trim();
  const role = body.role === 'tailor' ? 'tailor' : 'customer';

  if (!fullName || !email || !password) {
    return res.status(400).json({
      error: 'Full name, email, and password are required.',
      message: 'Full name, email, and password are required.',
    });
  }

  if (role === 'tailor') {
    const shopName = String(body.shopName || '').trim();
    const city = String(body.city || '').trim();
    const specialty = String(body.specialty || '').trim();
    if (!shopName || !city || !specialty) {
      return res.status(400).json({
        error: 'Shop name, city, and main specialty are required for tailor accounts.',
        message: 'Shop name, city, and main specialty are required for tailor accounts.',
      });
    }
  }

  const normalizedEmail = String(email).toLowerCase();
  let pending = null;

  try {
    const verifiedUser = await User.findOne({ email: normalizedEmail, isVerified: true });
    if (verifiedUser) {
      return res.status(409).json({ error: 'Email already registered.', message: 'Email already registered.' });
    }

    await removeStaleUnverifiedUserIfAny(normalizedEmail);

    await PendingSignup.deleteMany({ email: normalizedEmail, expiresAt: { $lte: new Date() } });

    if (role === 'customer') {
      console.log('Creating customer pending signup email=%s', normalizedEmail);
    }

    const signupPayload = buildSignupPayload(body, role, req.file);
    const otp = generateSixDigitOtp();
    const now = Date.now();

    pending = await PendingSignup.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          email: normalizedEmail,
          role,
          fullName,
          phone: String(body.phone || '').trim(),
          address: String(body.address || '').trim(),
          password,
          signupPayload,
          otpHash: hashEmailOtp(normalizedEmail, otp),
          otpExpiresAt: new Date(now + EMAIL_OTP_TTL_MS),
          expiresAt: new Date(now + PENDING_SIGNUP_TTL_MS),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('[register] pending signup created/updated email=%s role=%s', normalizedEmail, role);
    if (role === 'customer') {
      console.log('Customer pending signup saved email=%s', normalizedEmail);
    }

    try {
      await sendOtpMail({
        to: normalizedEmail,
        otp,
        purpose: 'signup',
        name: fullName,
        expiresMinutes: Math.floor(EMAIL_OTP_TTL_MS / 60000),
      });
      console.log('[register] OTP email sent email=%s role=%s', normalizedEmail, role);
    } catch (emailErr) {
      console.error('[register] OTP email failed email=%s', normalizedEmail, emailErr);
      await PendingSignup.deleteOne({ email: normalizedEmail }).catch(() => {});
      const otpMsg =
        emailErr && (emailErr.message === OTP_EMAIL_FAIL_MESSAGE || emailErr.code === 'OTP_EMAIL_SEND_FAILED')
          ? OTP_SIGNUP_EMAIL_FAIL_MSG
          : OTP_SIGNUP_EMAIL_FAIL_MSG;
      return res.status(500).json({ error: otpMsg, message: otpMsg });
    }

    return res.status(201).json({
      message: 'Enter the verification code we emailed you.',
      needsVerification: true,
      email: normalizedEmail,
      role,
    });
  } catch (error) {
    console.error('SIGNUP ERROR', error);
    if (pending?._id) {
      await PendingSignup.deleteOne({ _id: pending._id }).catch(() => {});
    }
    return res.status(500).json({
      error: 'Unable to create account right now.',
      message: 'Unable to create account right now.',
    });
  }
}

app.post('/signup', upload.single('avatar'), registerUser);
app.post('/api/register', upload.single('avatar'), registerUser);

const DEFAULT_TAILOR_SIGNUP_LNG = 74.3587;
const DEFAULT_TAILOR_SIGNUP_LAT = 31.5204;
const TAILOR_PENDING_LAT = 0;
const TAILOR_PENDING_LNG = 0;

function isTailorPendingLocationCoords(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
  if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return true;
  if (
    Math.abs(lat - DEFAULT_TAILOR_SIGNUP_LAT) < 0.0001 &&
    Math.abs(lng - DEFAULT_TAILOR_SIGNUP_LNG) < 0.0001
  ) {
    return true;
  }
  return false;
}

function isValidTailorCompleteProfileLocation(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (isTailorPendingLocationCoords(lat, lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

/** Create verified User (+ TailorProfile for tailors) after OTP verification. */
async function createFinalUserFromPendingSignup(pending) {
  const normalizedEmail = String(pending.email).trim().toLowerCase();
  const role = pending.role === 'tailor' ? 'tailor' : 'customer';
  const payload = pending.signupPayload && typeof pending.signupPayload === 'object' ? pending.signupPayload : {};

  if (role === 'customer') {
    console.log('Creating final verified customer email=%s', normalizedEmail);
  }

  const verifiedExists = await User.findOne({ email: normalizedEmail, isVerified: true });
  if (verifiedExists) {
    const err = new Error('Email already registered.');
    err.statusCode = 409;
    throw err;
  }

  const stale = await User.findOne({ email: normalizedEmail, isVerified: { $ne: true } });
  if (stale) {
    await rollbackRegisteredUser(stale, stale.role || 'customer');
  }

  let created = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nextUserId = await allocateNextNumericUserId();
    try {
      created = await User.create({
        id: nextUserId,
        fullName: String(pending.fullName || '').trim(),
        email: normalizedEmail,
        password: pending.password,
        role,
        phone: String(pending.phone || '').trim(),
        address: String(pending.address || '').trim(),
        experience: String(payload.experience || '').trim(),
        emailVerified: true,
        isVerified: true,
        emailOtpHash: '',
        emailOtpExpiresAt: null,
        emailVerifyToken: '',
        emailVerifyTokenExpiresAt: null,
        profileComplete: role === 'tailor' ? false : true,
      });
      console.log(
        '[verify-otp] final user created numericId=%s mongoId=%s role=%s email=%s',
        created.id,
        created._id,
        created.role,
        created.email
      );
      break;
    } catch (userErr) {
      if (isMongoDuplicateKeyError(userErr) && userErr.keyPattern?.id) {
        console.warn('[verify-otp] numeric user id collision, retrying', nextUserId);
        continue;
      }
      throw userErr;
    }
  }

  if (!created) {
    throw new Error('Could not assign a unique user id.');
  }

  if (role === 'customer') {
    console.log('Customer verification successful numericId=%s email=%s', created.id, normalizedEmail);
  }

  if (role === 'tailor') {
    const tailorShopId = `T-U${created.id}`;
    let lat = Number(payload.lat);
    let lng = Number(payload.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || isTailorPendingLocationCoords(lat, lng)) {
      lat = TAILOR_PENDING_LAT;
      lng = TAILOR_PENDING_LNG;
    }

    const existingProfile = await TailorProfile.findOne({ userId: created.id }).lean();
    if (existingProfile) {
      await rollbackRegisteredUser(created, role);
      const err = new Error('A tailor profile already exists for this account.');
      err.statusCode = 409;
      throw err;
    }

    const profile = await TailorProfile.create({
      userId: created.id,
      email: normalizedEmail,
      tailorShopId,
      shopName: String(payload.shopName || '').trim(),
      displayName: String(pending.fullName || '').trim(),
      city: String(payload.city || '').trim(),
      address: String(pending.address || '').trim(),
      location: { type: 'Point', coordinates: [lng, lat] },
      specialty: String(payload.specialty || '').trim(),
      bio: String(payload.bio || '').trim(),
      skillsNotes: String(payload.experience || '').trim(),
      experienceYears: Math.max(0, Number(payload.experienceYears) || 0),
      priceStart: Math.max(0, Number(payload.priceStart) || 1500),
      deliveryDays: Math.max(1, Number(payload.deliveryDays) || 7),
      imageUrl: String(payload.imageUrl || '').trim(),
      rating: 4.7,
      availability: 'available',
      published: false,
      locationVerified: false,
      locationStatus: 'pending',
    });
    console.log(
      '[verify-otp] tailor profile created userId=%s tailorShopId=%s',
      profile.userId,
      profile.tailorShopId
    );
  }

  return created;
}

function resolveTailorProfileComplete(user, tp) {
  if (!user || user.role !== 'tailor') return true;
  if (user.profileComplete === true) return true;
  if (user.profileComplete === false) return false;
  if (!tp) return false;
  const coords = tp.location && Array.isArray(tp.location.coordinates) ? tp.location.coordinates : [];
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const isPlaceholderOnly = hasCoords && isTailorPendingLocationCoords(lat, lng);
  return hasCoords && tp.published === true && !isPlaceholderOnly;
}

async function buildUserOutForSession(user) {
  if (!user) return null;
  let tailorShopId = null;
  let profileComplete = true;
  if (user.role === 'tailor') {
    const tp = await TailorProfile.findOne({ userId: user.id })
      .select('tailorShopId location published')
      .lean();
    if (tp && tp.tailorShopId) tailorShopId = String(tp.tailorShopId).trim();
    profileComplete = resolveTailorProfileComplete(user, tp);
  }
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role || 'customer',
    profileComplete,
    ...(tailorShopId ? { tailorShopId } : {}),
  };
}

async function loginUser(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.', message: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email: String(email).toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User not found.', message: 'User not found.' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid password.', message: 'Invalid password.' });
    }

    if (user.isVerified !== true) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        message: 'Please verify your email before logging in.',
      });
    }

    const userOut = await buildUserOutForSession(user);

    // Issue session cookie (backend is source of truth).
    setSessionCookie(res, userOut);

    return res.status(200).json({
      message: 'Login successful!',
      token: 'dummy-token-123',
      user: userOut,
    });
  } catch (error) {
    console.error('LOGIN ERROR', error);
    return res.status(500).json({ error: 'Unable to login right now.', message: 'Unable to login right now.' });
  }
}

app.post('/login', loginUser);
app.post('/api/login', loginUser);

app.get('/api/auth/me', async (req, res) => {
  try {
    const u = await loadAuthedUser(req);
    if (!u) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    // Refresh cookie expiry on active use.
    setSessionCookie(res, u);
    return res.status(200).json({ user: u });
  } catch (e) {
    console.error('GET /api/auth/me', e);
    clearSessionCookie(res);
    return res.status(401).json({ message: 'Not authenticated.' });
  }
});

// Back-compat: existing frontend calls `/api/me`.
app.get('/api/me', async (req, res) => {
  try {
    const u = await loadAuthedUser(req);
    if (!u) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Not authenticated.', user: null });
    }
    setSessionCookie(res, u);
    return res.status(200).json({ user: u });
  } catch (e) {
    clearSessionCookie(res);
    return res.status(401).json({ message: 'Not authenticated.', user: null });
  }
});

app.post('/api/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

function sortConversationsByActivity(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  return list.sort((a, b) => {
    const ta = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
    return tb - ta;
  });
}

function dedupeConversationsByOrderId(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  const seen = new Set();
  for (const r of list) {
    const oid = String(r.orderId || r.conversationId || '')
      .trim()
      .replace(/^order_/i, '');
    if (!oid || seen.has(oid)) continue;
    seen.add(oid);
    out.push(r);
  }
  return out;
}

/** Lists conversations for a tailor shop id, including legacy rows stored under T-A* while the order now points at this shop. */
async function fetchConversationRowsForTailorShop(shop) {
  const shopTrim = String(shop || '').trim();
  if (!shopTrim) return [];
  const primary = await Conversation.find({ tailorId: shopTrim }).lean();
  const legacy = await Conversation.find({ tailorId: { $regex: /^T-A\d+$/i } }).lean();
  if (legacy.length === 0) {
    return sortConversationsByActivity(dedupeConversationsByOrderId(primary));
  }
  const keys = [...new Set(legacy.map((r) => String(r.orderId || '').trim()).filter(Boolean))];
  const objectIds = keys.filter((k) => mongoose.Types.ObjectId.isValid(k));
  const clientIds = keys.filter((k) => !mongoose.Types.ObjectId.isValid(k));
  const or = [];
  if (objectIds.length) {
    or.push({ _id: { $in: objectIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  }
  if (clientIds.length) {
    or.push({ clientOrderId: { $in: clientIds } });
  }
  let orders = [];
  try {
    if (or.length === 1) {
      orders = await Order.find(or[0]).select('_id clientOrderId tailorId').lean();
    } else if (or.length > 1) {
      orders = await Order.find({ $or: or }).select('_id clientOrderId tailorId').lean();
    }
  } catch (e) {
    console.error('[fetchConversationRowsForTailorShop] orders', e);
  }
  const matchingIds = new Set();
  const clientToMongo = new Map();
  for (const o of orders || []) {
    const t = String(o.tailorId || '').trim();
    if (t === shopTrim) {
      const mid = String(o._id);
      matchingIds.add(mid);
      if (o.clientOrderId) clientToMongo.set(String(o.clientOrderId).trim(), mid);
    }
  }
  const extras = legacy.filter((c) => {
    const k = String(c.orderId || '').trim();
    if (matchingIds.has(k)) return true;
    const mapped = clientToMongo.get(k);
    return Boolean(mapped && matchingIds.has(mapped));
  });
  return sortConversationsByActivity(dedupeConversationsByOrderId([...primary, ...extras]));
}

app.get('/conversations/customer/:customerId', requireAuth, requireRole(['customer']), async (req, res) => {
  const cid = req.params.customerId != null ? String(req.params.customerId).trim() : '';
  if (!cid) return res.status(400).json({ conversations: [] });
  if (!authIdsMatch(req.authUser.id, cid)) {
    log403Conversations(req, 'customer', cid);
    return res.status(403).json({ conversations: [], message: 'Forbidden.' });
  }
  try {
    const raw = await Conversation.find({ customerId: cid }).lean();
    const rows = sortConversationsByActivity(dedupeConversationsByOrderId(raw));
    const ids = rows.map((r) => String(r.orderId || r.conversationId || '').trim());
    console.log('[ChatSync API] customer conversations fetched', cid, rows.length, ids);
    return res.json({ conversations: rows });
  } catch (e) {
    console.error('GET /conversations/customer/:customerId', e);
    return res.status(500).json({ conversations: [] });
  }
});

app.get('/conversations/tailor/:tailorId', requireAuth, requireRole(['tailor']), async (req, res) => {
  const tid = req.params.tailorId != null ? String(req.params.tailorId).trim() : '';
  const shop = await resolveTailorShopId(req);
  if (!tid || !shop || tid !== shop) {
    log403Conversations(req, 'tailor', tid, { resolvedShop: shop || '(none)' });
    return res.status(403).json({ conversations: [], message: 'Forbidden.' });
  }
  try {
    const rows = await fetchConversationRowsForTailorShop(tid);
    const ids = rows.map((r) => String(r.orderId || r.conversationId || '').trim());
    console.log('[ChatSync API] tailor conversations fetched', tid, rows.length, ids);
    return res.json({ conversations: rows });
  } catch (e) {
    console.error('GET /conversations/tailor/:tailorId', e);
    return res.status(500).json({ conversations: [] });
  }
});

app.get('/messages/:conversationId', requireAuth, async (req, res) => {
  const cid = req.params.conversationId != null ? String(req.params.conversationId).trim() : '';
  if (!cid) return res.json({ messages: [] });
  try {
    const orderKey = orderIdFromOrderChatConversationId(cid);
    const order = await findOrderDocByParam(orderKey);
    if (!order) return res.json({ messages: [] });
    const u = req.authUser;
    const cust = String(order.customerId || '').trim();
    const tail = String(order.tailorId || '').trim();
    if (u.role === 'customer') {
      if (!authIdsMatch(cust, u.id)) return res.status(403).json({ messages: [] });
    } else if (u.role === 'tailor') {
      const shopId = await resolveTailorShopId(req);
      if (!shopId || tail !== shopId) return res.status(403).json({ messages: [] });
    } else {
      return res.status(403).json({ messages: [] });
    }
    const variants = [...new Set([String(order._id), `order_${String(order._id)}`, cid])];
    const rows = await Message.find({ conversationId: { $in: variants } }).sort({ timestamp: 1 }).lean();
    return res.json({ messages: rows });
  } catch (e) {
    console.error('GET /messages/:conversationId', e);
    return res.status(500).json({ messages: [] });
  }
});

const MIN_PASSWORD_LENGTH = 6;

/** Password storage matches register/login (plain string on User model). */
function normalizeAccountPassword(raw) {
  return String(raw || '').trim();
}

/**
 * Password reset OTP for verified accounts only.
 * Stores OTP on User.emailOtpHash (same fields as legacy email verification).
 */
app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  try {
    const user = await User.findOne({ email, isVerified: true });
    if (!user) {
      return res.json({
        ok: true,
        message: 'If an account exists with this email, we sent a reset code.',
      });
    }

    const otp = generateSixDigitOtp();
    user.emailOtpHash = hashEmailOtp(email, otp);
    user.emailOtpExpiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);
    await user.save();

    try {
      await sendOtpMail({
        to: email,
        otp,
        purpose: 'password-reset',
        name: user.fullName,
        expiresMinutes: Math.floor(EMAIL_OTP_TTL_MS / 60000),
      });
      console.log('[forgot-password] reset OTP sent email=%s', email);
    } catch (emailErr) {
      console.error('[forgot-password] OTP email failed email=%s', email, emailErr);
      user.emailOtpHash = '';
      user.emailOtpExpiresAt = null;
      await user.save();
      const msg =
        emailErr && (emailErr.message === OTP_EMAIL_FAIL_MESSAGE || emailErr.code === 'OTP_EMAIL_SEND_FAILED')
          ? OTP_SIGNUP_EMAIL_FAIL_MSG
          : 'Could not send reset code. Please try again.';
      return res.status(500).json({ message: msg, error: msg });
    }

    return res.json({
      ok: true,
      message: 'If an account exists with this email, we sent a reset code.',
    });
  } catch (e) {
    console.error('POST /api/auth/forgot-password', e);
    return res.status(500).json({ message: 'Could not process password reset request.' });
  }
});

app.post('/api/auth/verify-reset-otp', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const otpRaw = String(req.body?.otp || '').replace(/\D/g, '');
  const newPassword = normalizeAccountPassword(req.body?.newPassword);

  if (!email || otpRaw.length !== 6) {
    return res.status(400).json({ message: 'Email and a 6-digit code are required.' });
  }
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  try {
    const user = await User.findOne({ email, isVerified: true });
    const otpMissing = !user?.emailOtpHash || !user?.emailOtpExpiresAt;
    const otpExpired = user?.emailOtpExpiresAt && user.emailOtpExpiresAt.getTime() < Date.now();
    const otpInvalid =
      !user || otpMissing || otpExpired || user.emailOtpHash !== hashEmailOtp(email, otpRaw);

    if (otpInvalid) {
      return res.status(400).json({ message: 'Invalid or expired verification code.' });
    }

    user.password = newPassword;
    user.emailOtpHash = '';
    user.emailOtpExpiresAt = null;
    await user.save();

    console.log('[verify-reset-otp] password updated email=%s', email);
    return res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (e) {
    console.error('POST /api/auth/verify-reset-otp', e);
    return res.status(500).json({ message: 'Could not reset password. Please try again.' });
  }
});

app.post('/api/auth/send-otp', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  try {
    const verifiedUser = await User.findOne({ email, isVerified: true });
    if (verifiedUser) {
      return res.status(400).json({ message: 'Account already verified. Please sign in.' });
    }

    await PendingSignup.deleteMany({ email, expiresAt: { $lte: new Date() } });

    const pending = await PendingSignup.findOne({ email });
    if (!pending) {
      return res.status(404).json({
        message: 'No pending signup found. Please complete the sign-up form again.',
      });
    }

    if (pending.expiresAt && pending.expiresAt.getTime() < Date.now()) {
      await PendingSignup.deleteOne({ _id: pending._id });
      return res.status(400).json({
        message: 'Sign-up session expired. Please sign up again.',
      });
    }

    try {
      await assignOtpToPendingAndSend(pending, 'resend');
      console.log('[send-otp] OTP email sent email=%s', email);
    } catch (emailErr) {
      console.error('[send-otp] OTP email failed email=%s', email, emailErr);
      const msg =
        emailErr && (emailErr.message === OTP_EMAIL_FAIL_MESSAGE || emailErr.code === 'OTP_EMAIL_SEND_FAILED')
          ? OTP_SIGNUP_EMAIL_FAIL_MSG
          : OTP_SIGNUP_EMAIL_FAIL_MSG;
      return res.status(500).json({ message: msg, error: msg });
    }

    return res.json({ ok: true, message: 'Verification code sent.' });
  } catch (e) {
    console.error('POST /api/auth/send-otp', e);
    return res.status(500).json({ message: 'Could not send verification code.', error: 'Could not send verification code.' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const otpRaw = String(req.body?.otp || '').replace(/\D/g, '');
  if (!email || otpRaw.length !== 6) {
    return res.status(400).json({ message: 'Email and a 6-digit code are required.' });
  }
  try {
    const verifiedUser = await User.findOne({ email, isVerified: true });
    if (verifiedUser) {
      const userOut = await buildUserOutForSession(verifiedUser);
      setSessionCookie(res, userOut);
      const redirectPath =
        verifiedUser.role === 'tailor' ? '/tailor/complete-profile' : '/customer/dashboard';
      return res.json({ ok: true, message: 'Already verified.', user: userOut, redirectPath });
    }

    const pending = await PendingSignup.findOne({ email });
    if (!pending) {
      return res.status(404).json({
        message: 'No pending signup found. Please sign up again.',
      });
    }

    if (pending.expiresAt && pending.expiresAt.getTime() < Date.now()) {
      await PendingSignup.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: 'Sign-up session expired. Please sign up again.' });
    }

    if (!pending.otpHash || !pending.otpExpiresAt || pending.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Code expired or missing. Request a new code.' });
    }

    if (pending.otpHash !== hashEmailOtp(email, otpRaw)) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    console.log('[verify-otp] OTP verified email=%s role=%s', email, pending.role);
    if (pending.role === 'customer') {
      console.log('Customer verification successful email=%s', email);
    }

    const created = await createFinalUserFromPendingSignup(pending);
    await PendingSignup.deleteOne({ _id: pending._id });

    const userOut = await buildUserOutForSession(created);
    setSessionCookie(res, userOut);

    const redirectPath = created.role === 'tailor' ? '/tailor/complete-profile' : '/customer/dashboard';

    (async () => {
      try {
        const appName = process.env.APP_NAME || 'SewServe';
        const webBase = process.env.WEB_BASE_URL || 'http://localhost:3000';
        const loginUrl = `${String(webBase).replace(/\/$/, '')}/login`;
        const tpl = makeWelcomeEmail({
          name: created.fullName,
          appName,
          loginUrl,
          verifyUrl: '',
        });
        await sendMailSafe({
          from: getMailFrom(),
          to: created.email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
      } catch (e) {
        console.error('[email] welcome after OTP', e);
      }
    })();

    return res.json({
      ok: true,
      message: 'Email verified successfully.',
      user: userOut,
      redirectPath,
    });
  } catch (e) {
    console.error('POST /api/auth/verify-otp', e);
    if (e && e.statusCode === 409) {
      return res.status(409).json({ message: e.message || 'Email already registered.' });
    }
    return res.status(500).json({ message: 'Verification failed.' });
  }
});

/** Public testimonials (landing). */
app.get('/api/testimonials', async (req, res) => {
  try {
    const rows = await Testimonial.find({}).sort({ createdAt: -1 }).limit(50).lean();
    const testimonials = rows.map((r) => ({
      name: r.name,
      feedback: r.feedback,
      avatar: r.avatar || '',
      rating: r.rating,
      orderId: r.orderId,
      createdAt: r.createdAt,
    }));
    return res.json({ testimonials });
  } catch (e) {
    console.error('GET /api/testimonials', e);
    return res.status(500).json({ testimonials: [] });
  }
});

/** Create testimonial after verified order review (order must exist). */
app.post('/api/testimonials', requireAuth, requireRole(['customer']), async (req, res) => {
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const orderIdParam = b.orderId != null ? String(b.orderId).trim() : '';
  const feedback = typeof b.feedback === 'string' ? b.feedback.trim() : '';
  if (!orderIdParam || !feedback) {
    return res.status(400).json({ message: 'orderId and feedback are required.' });
  }
  try {
    console.log('POST /api/testimonials', {
      orderIdParam,
      authCustomerId: req.authUser?.id,
    });
    const order = await findOrderDocByParam(orderIdParam);
    if (!order) {
      console.warn('POST /api/testimonials order not found', orderIdParam);
      return res.status(404).json({ message: 'Order not found.' });
    }
    const canonicalOrderId = String(order._id);
    // Enforce that the logged-in customer owns the order.
    if (!customerOwnsOrder(req, order.customerId, b)) {
      console.warn('POST /api/testimonials forbidden (order not owned)', {
        canonicalOrderId,
        orderCustomerId: String(order.customerId).trim(),
        authCustomerId: String(req.authUser.id),
      });
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const name =
      typeof b.name === 'string' && b.name.trim()
        ? b.name.trim()
        : order.customerName || 'Customer';
    const avatar = typeof b.avatar === 'string' ? b.avatar.trim() : '';
    const rating = Math.min(5, Math.max(0, Number(b.rating) || 0));
    const created = await Testimonial.create({
      name,
      feedback,
      avatar,
      rating,
      orderId: canonicalOrderId,
    });
    return res.status(201).json({
      testimonial: {
        name: created.name,
        feedback: created.feedback,
        avatar: created.avatar,
        rating: created.rating,
        orderId: created.orderId,
      },
    });
  } catch (e) {
    console.error('POST /api/testimonials', e);
    return res.status(500).json({ message: 'Could not save testimonial.' });
  }
});

app.get('/api/account/wizard-draft', requireAuth, requireRole(['customer']), async (req, res) => {
  try {
    const user = await User.findOne({ id: Number(req.authUser.id), email: String(req.authUser.email) }).exec();
    if (!user) return res.status(403).json({ draft: null, message: 'Forbidden.' });
    return res.json({
      draft: user.wizardDraft != null ? user.wizardDraft : null,
      updatedAt: user.wizardDraftUpdatedAt || null,
    });
  } catch (e) {
    console.error('GET /api/account/wizard-draft', e);
    return res.status(500).json({ draft: null });
  }
});

app.put('/api/account/wizard-draft', requireAuth, requireRole(['customer']), async (req, res) => {
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const user = await User.findOne({ id: Number(req.authUser.id), email: String(req.authUser.email) }).exec();
    if (!user) return res.status(403).json({ message: 'Forbidden.' });
    if (b.draft === undefined) {
      return res.status(400).json({ message: 'draft field required (object or null).' });
    }
    if (b.draft === null) {
      user.wizardDraft = null;
      user.wizardDraftUpdatedAt = null;
    } else {
      user.wizardDraft = b.draft;
      user.wizardDraftUpdatedAt = new Date();
    }
    await user.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/account/wizard-draft', e);
    return res.status(500).json({ message: 'Could not save draft.' });
  }
});

app.get('/api/account/customer-meta', requireAuth, requireRole(['customer']), async (req, res) => {
  try {
    const user = await User.findOne({ id: Number(req.authUser.id), email: String(req.authUser.email) }).exec();
    if (!user) return res.status(403).json({ message: 'Forbidden.' });
    return res.json({
      lastWizardOrderId: user.lastWizardOrderId != null ? String(user.lastWizardOrderId) : '',
      lastKnownLocation: user.lastKnownLocation || null,
      lastMapTailorRequest: user.lastMapTailorRequest || null,
    });
  } catch (e) {
    console.error('GET /api/account/customer-meta', e);
    return res.status(500).json({ message: 'Unable to load account data.' });
  }
});

app.put('/api/account/customer-meta', requireAuth, requireRole(['customer']), async (req, res) => {
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const user = await User.findOne({ id: Number(req.authUser.id), email: String(req.authUser.email) }).exec();
    if (!user) return res.status(403).json({ message: 'Forbidden.' });
    if (b.lastWizardOrderId !== undefined) {
      user.lastWizardOrderId =
        b.lastWizardOrderId != null ? String(b.lastWizardOrderId).trim() : '';
    }
    if (b.lastKnownLocation !== undefined) {
      user.lastKnownLocation =
        b.lastKnownLocation && typeof b.lastKnownLocation === 'object' ? b.lastKnownLocation : null;
    }
    if (b.lastMapTailorRequest !== undefined) {
      user.lastMapTailorRequest =
        b.lastMapTailorRequest && typeof b.lastMapTailorRequest === 'object'
          ? b.lastMapTailorRequest
          : null;
    }
    await user.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/account/customer-meta', e);
    return res.status(500).json({ message: 'Could not update account data.' });
  }
});

app.get('/api/tailor/profile-self', requireAuth, requireRole(['tailor']), async (req, res) => {
  try {
    const user = await User.findOne({ id: Number(req.authUser.id), email: String(req.authUser.email) }).exec();
    if (!user) return res.status(403).json({ message: 'Forbidden.' });
    const tp = await TailorProfile.findOne({ userId: user.id }).lean();
    if (!tp) return res.json({ profile: null });
    return res.json({
      profile: {
        name: (tp.displayName && String(tp.displayName).trim()) || tp.shopName || '',
        skills: tp.skillsNotes || '',
        experience: String(tp.experienceYears ?? ''),
      },
    });
  } catch (e) {
    console.error('GET /api/tailor/profile-self', e);
    return res.status(500).json({ message: 'Unable to load profile.' });
  }
});

app.patch('/api/tailor/profile-self', requireAuth, requireRole(['tailor']), async (req, res) => {
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const user = await User.findOne({ id: Number(req.authUser.id), email: String(req.authUser.email) }).exec();
    if (!user) return res.status(403).json({ message: 'Forbidden.' });
    const tp = await TailorProfile.findOne({ userId: user.id });
    if (!tp) return res.status(404).json({ message: 'No tailor profile.' });
    if (b.name != null && String(b.name).trim()) {
      const nm = String(b.name).trim();
      tp.displayName = nm;
      tp.shopName = nm;
    }
    if (b.skills != null) {
      tp.skillsNotes = String(b.skills);
    }
    if (b.experience != null && b.experience !== '') {
      const n = Number(b.experience);
      if (Number.isFinite(n) && n >= 0) tp.experienceYears = Math.floor(n);
    }
    await tp.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/tailor/profile-self', e);
    return res.status(500).json({ message: 'Could not update profile.' });
  }
});

app.get('/api/tailor/onboarding-profile', requireAuth, requireRole(['tailor']), async (req, res) => {
  try {
    const user = await User.findOne({ id: Number(req.authUser.id), email: String(req.authUser.email) }).exec();
    if (!user) return res.status(403).json({ message: 'Forbidden.' });
    const tp = await TailorProfile.findOne({ userId: user.id }).lean();
    if (!tp) return res.json({ profile: null, profileComplete: false });
    const coords = tp.location && Array.isArray(tp.location.coordinates) ? tp.location.coordinates : [];
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    const pendingLocation = isTailorPendingLocationCoords(lat, lng);
    return res.json({
      profileComplete: resolveTailorProfileComplete(user, tp),
      profile: {
        shopName: tp.shopName || '',
        city: tp.city || '',
        specialty: tp.specialty || '',
        bio: tp.bio || '',
        experienceYears: tp.experienceYears ?? 0,
        priceStart: tp.priceStart ?? 1500,
        deliveryDays: tp.deliveryDays ?? 7,
        address: tp.address || '',
        lat: pendingLocation ? null : lat,
        lng: pendingLocation ? null : lng,
        imageUrl: tp.imageUrl || '',
      },
    });
  } catch (e) {
    console.error('GET /api/tailor/onboarding-profile', e);
    return res.status(500).json({ message: 'Unable to load profile.' });
  }
});

app.post(
  '/api/tailor/complete-profile',
  requireAuth,
  requireRole(['tailor']),
  upload.single('avatar'),
  async (req, res) => {
    const body = req.body || {};
    try {
      const user = await User.findOne({ id: Number(req.authUser.id), email: String(req.authUser.email) }).exec();
      if (!user) return res.status(403).json({ message: 'Forbidden.' });
      const tp = await TailorProfile.findOne({ userId: user.id });
      if (!tp) return res.status(404).json({ message: 'No tailor profile.' });

      const latRaw = body.lat != null ? String(body.lat).trim() : '';
      const lngRaw = body.lng != null ? String(body.lng).trim() : '';
      const lat = latRaw !== '' ? Number(latRaw) : NaN;
      const lng = lngRaw !== '' ? Number(lngRaw) : NaN;
      if (!isValidTailorCompleteProfileLocation(lat, lng)) {
        return res.status(400).json({
          message: 'Valid location coordinates (lat/lng) are required.',
        });
      }

      if (body.bio != null) tp.bio = String(body.bio).trim();
      const ey = parseInt(String(body.experienceYears || '0'), 10);
      const ps = parseInt(String(body.priceStart || '1500'), 10);
      const dd = parseInt(String(body.deliveryDays || '7'), 10);
      tp.experienceYears = Number.isFinite(ey) && ey >= 0 ? ey : 0;
      tp.priceStart = Number.isFinite(ps) && ps > 0 ? ps : 1500;
      tp.deliveryDays = Number.isFinite(dd) && dd > 0 ? dd : 7;
      if (body.address != null) tp.address = String(body.address).trim();
      tp.location = { type: 'Point', coordinates: [lng, lat] };
      tp.locationVerified = true;
      tp.locationStatus = 'verified';
      if (req.file) {
        tp.imageUrl = `/uploads/${req.file.filename}`;
      }
      tp.published = true;
      await tp.save();

      user.profileComplete = true;
      await user.save();

      const userOut = await buildUserOutForSession(user);
      setSessionCookie(res, userOut);
      return res.json({ ok: true, user: userOut });
    } catch (e) {
      console.error('POST /api/tailor/complete-profile', e);
      return res.status(500).json({ message: 'Could not save profile.' });
    }
  }
);

/** Public listing for Browse Tailors (no auth). */
app.get('/api/tailors/public', async (req, res) => {
  try {
    const docs = await TailorProfile.find({ published: true }).sort({ createdAt: -1 }).exec();
    const tailors = docs.map((d, i) => mapTailorProfileToPublicRow(d, i)).filter(Boolean);
    return res.json({ tailors, source: 'api' });
  } catch (e) {
    console.error('GET /api/tailors/public', e);
    return res.status(500).json({ tailors: [], error: 'Unable to load tailors.' });
  }
});

/**
 * Compatibility endpoint (requested by frontend): list all tailors.
 * Mirrors `/api/tailors/public` but under a simpler path.
 */
app.get('/api/tailors', async (req, res) => {
  try {
    const docs = await TailorProfile.find({ published: true }).sort({ createdAt: -1 }).exec();
    const tailors = docs.map((d, i) => mapTailorProfileToPublicRow(d, i)).filter(Boolean);
    return res.json({ tailors, source: 'api' });
  } catch (e) {
    console.error('GET /api/tailors', e);
    return res.status(500).json({ tailors: [], error: 'Unable to load tailors.' });
  }
});

/** Geospatial nearby tailors (requires TailorProfile.location 2dsphere). */
app.get('/api/tailors/nearby', async (req, res) => {
  const lat = req.query.lat != null ? Number(String(req.query.lat)) : NaN;
  const lng = req.query.lng != null ? Number(String(req.query.lng)) : NaN;
  const radiusKmRaw = req.query.radiusKm != null ? Number(String(req.query.radiusKm)) : 5;
  const radiusKm = Number.isFinite(radiusKmRaw) && radiusKmRaw > 0 ? radiusKmRaw : 5;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ tailors: [], error: 'lat and lng are required.' });
  }
  try {
    const radiusM = Math.max(100, Math.round(radiusKm * 1000));
    const rows = await TailorProfile.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: radiusM,
          spherical: true,
          query: { published: true },
        },
      },
      { $limit: 60 },
    ]);

    const tailors = rows
      .map((row, idx) => {
        const t = mapTailorProfileToPublicRow(row, idx);
        if (!t) return null;
        const km = Number(row.distanceMeters) / 1000;
        if (Number.isFinite(km)) {
          t.distanceKm = Number(km.toFixed(2));
          t.distanceLabel = `${t.distanceKm} km`;
        }
        return t;
      })
      .filter(Boolean);

    return res.json({ tailors, radiusKm, source: 'geo' });
  } catch (e) {
    console.error('GET /api/tailors/nearby', e);
    return res.status(500).json({ tailors: [], error: 'Unable to load nearby tailors.' });
  }
});

/** Single tailor for public profile: Mongo _id or tailorShopId (e.g. T-U3). */
app.get('/api/tailors/public/:idOrShopId', async (req, res) => {
  const raw = req.params.idOrShopId != null ? String(req.params.idOrShopId).trim() : '';
  if (!raw) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    let doc = null;
    if (mongoose.Types.ObjectId.isValid(raw)) {
      doc = await TailorProfile.findById(raw).exec();
    }
    if (!doc) {
      doc = await TailorProfile.findOne({ tailorShopId: raw }).exec();
    }
    if (!doc || !doc.published) {
      return res.status(404).json({ error: 'Tailor not found' });
    }
    const tailor = mapTailorProfileToPublicRow(doc, 0);
    return res.json({ tailor });
  } catch (e) {
    console.error('GET /api/tailors/public/:id', e);
    return res.status(500).json({ error: 'Unable to load tailor' });
  }
});

const normalizeOrderStatus = (status = '') => {
  const value = String(status).trim().toLowerCase().replace(/\s+/g, '_');
  if (value === 'draft' || value === 'awaiting_tailor_selection') return value;
  if (value === 'accepted' || value === 'active') return value;
  if (value === 'rejected' || value === 'declined' || value === 'cancelled' || value === 'canceled') {
    return value;
  }
  if (value === 'in_progress' || value === 'inprogress') return 'in_progress';
  if (value === 'assigned') return 'assigned';
  if (
    value === 'order_placed' ||
    value === 'pending' ||
    value === 'measurements_verified' ||
    value === 'processing' ||
    value === 'stitching' ||
    value === 'quality_check' ||
    value === 'ready_for_delivery' ||
    value === 'last_review' ||
    value === 'needs_alteration' ||
    value === 'completed'
  ) {
    return value;
  }
  return 'pending';
};

const WORKFLOW_STAGES = [
  'pending',
  'measurements_verified',
  'stitching',
  'quality_check',
  'ready_for_delivery',
  'last_review',
  'completed',
];

/** Uppercase tracking enum — must match customer/tailor `orderLiveStatus.js`. */
function internalStatusToTrackingStatus(s) {
  const v = normalizeOrderStatus(s);
  if (v === 'pending' || v === 'order_placed' || v === 'assigned') return 'ORDER_PLACED';
  if (v === 'measurements_verified') return 'MEASUREMENTS_VERIFIED';
  if (v === 'stitching' || v === 'in_progress' || v === 'processing' || v === 'needs_alteration') {
    return 'STITCHING';
  }
  if (v === 'quality_check') return 'QUALITY_CHECK';
  if (v === 'ready_for_delivery' || v === 'last_review') return 'READY';
  if (v === 'completed') return 'COMPLETED';
  return 'ORDER_PLACED';
}

const MAX_WORKFLOW_STEP_INDEX = WORKFLOW_STAGES.length - 1;

const WORKFLOW_STEP_STATUS_MAP = {
  pending: 0,
  order_placed: 0,
  assigned: 0,
  measurements_verified: 1,
  processing: 2,
  in_progress: 2,
  stitching: 2,
  quality_check: 3,
  ready_for_delivery: 4,
  last_review: 5,
  completed: 6,
  needs_alteration: 5,
};

function computeWorkflow(raw = {}) {
  const status = normalizeOrderStatus(raw.status != null ? raw.status : raw.workflowStatus);
  const merged = {
    ...raw,
    status,
    currentStepIndex: raw.currentStepIndex ?? raw.currentStep,
  };
  const rawIdx = merged.currentStepIndex;
  let currentStepIndex;
  if (rawIdx != null && Number.isFinite(Number(rawIdx))) {
    currentStepIndex = Math.max(0, Math.min(MAX_WORKFLOW_STEP_INDEX, Number(rawIdx)));
  } else {
    const v = normalizeOrderStatus(merged.status);
    currentStepIndex = Math.max(
      0,
      Math.min(MAX_WORKFLOW_STEP_INDEX, WORKFLOW_STEP_STATUS_MAP[v] ?? 0)
    );
  }
  const workflowStatus = status;
  return { status, workflowStatus, currentStepIndex, updatedAt: new Date().toISOString() };
}

function emitToRoomUnion(ioInstance, roomNames, event, data) {
  const rooms = [...new Set((roomNames || []).map((r) => String(r).trim()).filter(Boolean))];
  if (rooms.length === 0) return;
  if (!ioInstance || typeof ioInstance.to !== 'function') {
    console.warn('[emitToRoomUnion] io not ready, skip', event);
    return;
  }
  ioInstance.to(rooms).emit(event, data);
}

async function findOrderDocByParam(orderIdParam) {
  const raw = orderIdParam != null ? String(orderIdParam).trim() : '';
  if (!raw) return null;
  try {
    if (mongoose.Types.ObjectId.isValid(raw)) {
      const byId = await Order.findById(raw);
      if (byId) return byId;
    }
    return await Order.findOne({ clientOrderId: raw });
  } catch (e) {
    console.error('findOrderDocByParam', e);
    return null;
  }
}

/** Plain merge input for computeWorkflow — avoids rare toObject failures on hydrated docs. */
function orderDocToPlainForWorkflow(orderDoc) {
  if (!orderDoc || typeof orderDoc !== 'object') return {};
  try {
    if (typeof orderDoc.toObject === 'function') {
      return orderDoc.toObject({ depopulate: true, virtuals: false, flattenMaps: true });
    }
  } catch (e) {
    console.error('[orderDocToPlainForWorkflow] toObject failed', e && e.message);
  }
  try {
    return { ...orderDoc };
  } catch (e2) {
    console.error('[orderDocToPlainForWorkflow] spread failed', e2 && e2.message);
    return {};
  }
}

/** Normalize Mongo/ObjectId / { $oid } / nested _id for order linkage fields */
function stringifyOrderIdField(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'object' && v !== null) {
    // BSON / Mongoose ObjectId: never recurse on `. _id` — getters can recurse infinitely.
    if (v instanceof mongoose.Types.ObjectId) {
      try {
        return v.toString();
      } catch {
        return '';
      }
    }
    const bsonType = v._bsontype;
    if (bsonType === 'ObjectId' || bsonType === 'ObjectID') {
      try {
        return String(v).trim();
      } catch {
        return '';
      }
    }
    if (v.$oid != null) return String(v.$oid).trim();
    if (v._id != null && v._id !== v) return stringifyOrderIdField(v._id);
  }
  const s = String(v).trim();
  if (s === '[object Object]') return '';
  return s;
}

/** True for generic demo shop ids (T-A1, T-A2, …) — never used for conversations, chat, or measurement socket rooms. */
function isPlaceholderTailorShopId(tailorId) {
  const t = stringifyOrderIdField(tailorId);
  if (!t) return true;
  return /^T-A\d+$/i.test(t);
}

/**
 * Orders may be created before a real shop is chosen; allow PATCH { tailorId: shop } when unassigned or placeholder only.
 */
function isPlaceholderTailorIdForClaim(tailorId) {
  return isPlaceholderTailorShopId(tailorId);
}

function normalizeId(value) {
  return stringifyOrderIdField(value).trim();
}

function isRealTailorId(tailorId) {
  const t = normalizeId(tailorId);
  return Boolean(t) && !isPlaceholderTailorShopId(t);
}

/**
 * Decide whether PATCH may set order.tailorId (customer-selected id is sticky once set).
 */
function resolveTailorIdPatchDecision(existingDoc, body, authUser) {
  const b = body && typeof body === 'object' ? body : {};
  const existingTailorId = normalizeId(existingDoc?.tailorId);
  const incomingTailorId = b.tailorId != null ? normalizeId(b.tailorId) : '';
  const explicitClaim = b.action === 'accept_order' || b.action === 'claim_order';

  let shouldUpdateTailorId = false;
  if (incomingTailorId && isRealTailorId(incomingTailorId)) {
    if (!existingTailorId || isPlaceholderTailorIdForClaim(existingTailorId)) {
      shouldUpdateTailorId = true;
    } else if (explicitClaim && authUser?.role === 'tailor') {
      const shop = normalizeId(authUser.tailorShopId);
      if (shop && incomingTailorId === shop && existingTailorId === shop) {
        shouldUpdateTailorId = false;
      } else if (shop && incomingTailorId === shop && existingTailorId !== shop) {
        shouldUpdateTailorId = false;
        console.warn('[Tailor Guard] claim rejected — order assigned to', existingTailorId);
      }
    } else if (authUser?.role === 'customer') {
      shouldUpdateTailorId = false;
    }
  }

  console.log('[Tailor Guard] existing', existingTailorId || '(none)');
  console.log('[Tailor Guard] incoming', incomingTailorId || '(none)');
  console.log('[Tailor Guard] allowed update', shouldUpdateTailorId);

  return { shouldUpdateTailorId, incomingTailorId, existingTailorId, explicitClaim };
}

/**
 * `orderAccepted` is for tailor claim / focus — not wizard autosave (name, measurements, etc.).
 */
function shouldEmitOrderAcceptedOnPatch(existingDoc, body) {
  const b = body && typeof body === 'object' ? body : {};
  if (b.action === 'accept_order') return true;
  if (b.action === 'select_tailor') return false;
  if (b.isActive === true) return true;
  return false;
}

function emitOrderLiveToOrderRooms(ioInstance, canonicalOrderId, rawOrderId, payload, legacyStatusPayload) {
  const rooms = new Set([String(canonicalOrderId).trim()]);
  const raw = rawOrderId != null ? String(rawOrderId).trim() : '';
  if (raw && raw !== String(canonicalOrderId).trim()) rooms.add(raw);
  const roomList = [...rooms].filter(Boolean);
  if (roomList.length === 0) return;
  emitToRoomUnion(ioInstance, roomList, 'order:liveUpdate', payload);
  if (legacyStatusPayload) {
    emitToRoomUnion(ioInstance, roomList, 'order:statusUpdated', legacyStatusPayload);
  }
}

function serializeOrderForSocket(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ virtuals: true }) : { ...doc };
  if (o._id) o.id = String(o._id);
  return o;
}

function buildWorkflowSocketPayload(orderDoc, fallbackOrderId = '') {
  const fullOrder = serializeOrderForSocket(orderDoc);
  const normalized = computeWorkflow(fullOrder || { id: fallbackOrderId });
  const orderId = String(fullOrder?.id || fullOrder?._id || fallbackOrderId || '').trim();
  return {
    orderId,
    clientOrderId: fullOrder?.clientOrderId != null ? String(fullOrder.clientOrderId) : '',
    tailorId: fullOrder?.tailorId != null ? String(fullOrder.tailorId) : '',
    fullOrder: fullOrder
      ? {
          ...fullOrder,
          status: normalized.status,
          workflowStatus: normalized.workflowStatus,
          currentStepIndex: normalized.currentStepIndex,
        }
      : null,
    order: fullOrder
      ? {
          ...fullOrder,
          status: normalized.status,
          workflowStatus: normalized.workflowStatus,
          currentStepIndex: normalized.currentStepIndex,
        }
      : null,
    status: normalized.status,
    workflowStatus: normalized.workflowStatus,
    currentStepIndex: normalized.currentStepIndex,
    updatedAt: normalized.updatedAt,
  };
}

async function applySocketOrderStatusUpdate(socket, data, emitLiveUpdate) {
  const rawOrderId = data.orderId != null ? String(data.orderId).trim() : '';
  if (!rawOrderId) return;
  socket.join(rawOrderId);
  let canonicalId = rawOrderId;
  try {
    const doc = await findOrderDocByParam(rawOrderId);
    if (doc) canonicalId = String(doc._id);
  } catch (err) {
    console.error(emitLiveUpdate ? '[SERVER] order:statusUpdate load' : '[RELAY] order:statusUpdated', err);
  }
  if (canonicalId !== rawOrderId) {
    socket.join(canonicalId);
  }
  let updatedDoc = await findOrderDocByParam(canonicalId);
  if (updatedDoc && data.status != null && String(data.status).trim() !== '') {
    const unified = computeWorkflow({ ...updatedDoc.toObject(), status: String(data.status) });
    updatedDoc = await Order.findByIdAndUpdate(
      String(updatedDoc._id),
      { $set: unified },
      { new: true, strict: false }
    );
  }
  const payload = buildWorkflowSocketPayload(updatedDoc, canonicalId);
  if (emitLiveUpdate) {
    console.log('[Socket Sync] order:liveUpdate', payload.orderId, payload.status, payload.currentStepIndex);
    emitOrderLiveToOrderRooms(io, canonicalId, rawOrderId, payload, payload);
  } else {
    console.log('[Socket Sync] order:statusUpdated', payload.orderId, payload.status, payload.currentStepIndex);
    emitToRoomUnion(io, [canonicalId, rawOrderId], 'order:statusUpdated', payload);
  }
}

function emitMeasurementOrderToTailor(orderDoc) {
  try {
    if (!io || !orderDoc) return;
    const tid = orderDoc.tailorId != null ? String(orderDoc.tailorId).trim() : '';
    if (!tid || isPlaceholderTailorShopId(tid)) return;
    const payload = buildWorkflowSocketPayload(orderDoc);
    console.log('[Socket Sync] measurement:updated', payload.orderId, payload.status, payload.currentStepIndex);
    io.to(tid).emit('measurement:updated', payload);
  } catch (e) {
    console.error('EMIT measurement:updated', e);
  }
}

/**
 * Tailor dashboard joins `join_user` with userId === tailor shop id (e.g. T-U17).
 * Target that room so only the assigned tailor receives the review popup.
 */
function emitMeasurementReviewedToTailorRoom(io, out) {
  if (!io || !out || typeof out !== 'object') return;
  const fromPayload = out.tailorId != null ? String(out.tailorId).trim() : '';
  const fromOrder =
    out.fullOrder && out.fullOrder.tailorId != null ? String(out.fullOrder.tailorId).trim() : '';
  const tid = fromPayload || fromOrder;
  const oid = out.orderId != null ? String(out.orderId).trim() : '';
  const rooms = [];
  if (tid) {
    console.log('[Socket Sync] measurement:reviewed → tailor room', tid, oid || out.orderId);
    rooms.push(tid);
  }
  if (oid) {
    console.log('[Socket Sync] measurement:reviewed → order room', oid);
    if (!rooms.includes(oid)) rooms.push(oid);
  }
  if (rooms.length) {
    emitToRoomUnion(io, rooms, 'measurement:reviewed', out);
    return;
  }
  console.warn('[Socket Sync] measurement:reviewed fallback broadcast (no tailorId/orderId)', out.orderId);
  io.emit('measurement:reviewed', out);
}

app.post('/orders', requireAuth, async (req, res) => {
  const b = req.body || {};
  const { customerId, customerName, garmentType, measurements, price, status, dueDate } = b;
  const tailorIdRaw = b.tailorId != null ? String(b.tailorId).trim() : '';
  const statusRaw =
    status != null ? String(status).trim().toLowerCase().replace(/\s+/g, '_') : '';
  const statusNorm = status != null ? normalizeOrderStatus(String(status)) : '';
  const isAwaitingTailorDraft =
    statusRaw === 'awaiting_tailor_selection' ||
    statusRaw === 'draft' ||
    statusNorm === 'awaiting_tailor_selection' ||
    statusNorm === 'draft' ||
    b.createDraft === true ||
    b.awaitingTailorSelection === true;

  if (!customerId) {
    return res.status(400).json({ message: 'customerId is required.' });
  }
  if (!tailorIdRaw && !isAwaitingTailorDraft) {
    return res.status(400).json({ message: 'customerId and tailorId are required.' });
  }

  try {
    // Server-side safety: customers can only create orders for themselves.
    if (req.authUser.role === 'customer' && !authIdsMatch(customerId, req.authUser.id)) {
      log403PatchOrder(req, null, b, { phase: 'POST /orders create' });
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (isAwaitingTailorDraft && req.authUser.role === 'customer') {
      const draftStatus = 'draft';
      const savedOrder = await Order.create({
        clientOrderId: b.clientOrderId != null ? String(b.clientOrderId) : b.orderId != null ? String(b.orderId) : '',
        source: b.source != null ? String(b.source) : 'measurement_wizard',
        customerId: String(customerId),
        tailorId: '',
        customerName: customerName || '',
        customerPhone: b.customerPhone != null ? String(b.customerPhone) : '',
        garmentType: garmentType || '',
        garmentCategory: b.garmentCategory != null ? String(b.garmentCategory) : '',
        measurements: measurements && typeof measurements === 'object' ? measurements : {},
        style: b.style && typeof b.style === 'object' ? b.style : null,
        notes: b.notes && typeof b.notes === 'object' ? b.notes : null,
        orderPayload: b.orderPayload != null ? b.orderPayload : null,
        price: Number(price || 0),
        status: draftStatus,
        workflowStatus: draftStatus,
        currentStepIndex: 0,
        isActive: false,
        chatEnabled: false,
        dueDate: dueDate ? new Date(dueDate) : null,
      });
      console.log('DRAFT ORDER CREATED (awaiting tailor)', savedOrder._id.toString());
      return res.status(201).json(savedOrder);
    }
    if (req.authUser.role === 'customer' && isPlaceholderTailorShopId(tailorIdRaw)) {
      return res.status(400).json({
        message: 'Select a tailor shop before placing your order.',
      });
    }
    const tailorId = tailorIdRaw;
    // Tailors can only create orders for their own shop id.
    if (req.authUser.role === 'tailor') {
      const shop = req.authUser.tailorShopId != null ? String(req.authUser.tailorShopId).trim() : '';
      if (!shop || String(tailorId).trim() !== shop) {
        return res.status(403).json({ message: 'Forbidden.' });
      }
    }
    const workflow = computeWorkflow({
      status: status != null && String(status).trim() !== '' ? status : 'pending',
    });
    const savedOrder = await Order.create({
      clientOrderId: b.clientOrderId != null ? String(b.clientOrderId) : b.orderId != null ? String(b.orderId) : '',
      source: b.source != null ? String(b.source) : '',
      customerId: String(customerId),
      tailorId: String(tailorId),
      customerName: customerName || '',
      customerPhone: b.customerPhone != null ? String(b.customerPhone) : '',
      garmentType: garmentType || '',
      garmentCategory: b.garmentCategory != null ? String(b.garmentCategory) : '',
      measurements: measurements && typeof measurements === 'object' ? measurements : {},
      style: b.style && typeof b.style === 'object' ? b.style : null,
      notes: b.notes && typeof b.notes === 'object' ? b.notes : null,
      orderPayload: b.orderPayload != null ? b.orderPayload : null,
      price: Number(price || 0),
      status: workflow.status,
      workflowStatus: workflow.workflowStatus,
      currentStepIndex: workflow.currentStepIndex,
      dueDate: dueDate ? new Date(dueDate) : null,
    });
    console.log('ORDER CREATED', savedOrder._id.toString());
    emitMeasurementOrderToTailor(savedOrder);
    try {
      const payload = buildWorkflowSocketPayload(savedOrder);
      console.log('[Socket Sync] order:new', payload.orderId, payload.status, payload.currentStepIndex);
      io.emit('order:new', payload);
    } catch (e) {
      console.error('EMIT order:new', e);
    }
    return res.status(201).json(savedOrder);
  } catch (error) {
    console.error('ORDER CREATE ERROR', error);
    return res.status(500).json({ message: 'Unable to create order right now.' });
  }
});

/** Unified list: optional ?customerId= & ?tailorId= (same collection as customer/tailor routes). */
app.get('/orders', requireAuth, async (req, res) => {
  try {
    const q = {};
    const customerId = req.query.customerId != null ? String(req.query.customerId).trim() : '';
    const tailorId = req.query.tailorId != null ? String(req.query.tailorId).trim() : '';
    if (customerId && req.authUser.role === 'customer' && !authIdsMatch(customerId, req.authUser.id)) {
      log403PatchOrder(req, null, req.query, { phase: 'GET /orders query' });
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (tailorId && req.authUser.role === 'tailor') {
      const shop = await resolveTailorShopId(req);
      if (!shop || tailorId !== shop) {
        log403PatchOrder(req, null, req.query, { phase: 'GET /orders query tailor' });
        return res.status(403).json({ message: 'Forbidden.' });
      }
    }
    if (customerId) q.customerId = customerId;
    if (tailorId) q.tailorId = tailorId;
    const orders = await Order.find(q).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    console.error('FETCH ORDERS (QUERY) ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch orders.' });
  }
});

app.get('/orders/customer/:customerId', requireAuth, requireRole(['customer']), async (req, res) => {
  const { customerId } = req.params;
  try {
    if (!authIdsMatch(customerId, req.authUser.id)) {
      log403PatchOrder(req, null, { customerId }, { phase: 'GET /orders/customer/:id' });
      return res.status(403).json({ message: 'Forbidden.' });
    }
    console.log('FETCH CUSTOMER ORDERS', customerId);
    const orders = await Order.find({ customerId: String(customerId) }).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    console.error('FETCH CUSTOMER ORDERS ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch customer orders.' });
  }
});

const CUSTOMER_TRACK_TERMINAL = new Set([
  'completed',
  'cancelled',
  'canceled',
  'rejected',
  'declined',
  'delivered',
]);

function isCustomerTrackableActiveOrderDoc(doc) {
  if (!doc) return false;
  const v = normalizeOrderStatus(doc.status);
  if (CUSTOMER_TRACK_TERMINAL.has(v)) return false;
  if (v === 'draft' || v === 'awaiting_tailor_selection') return false;
  if (doc.isActive === true) return true;
  if (doc.acceptedAt) return true;
  if (v === 'accepted' || v === 'active' || v === 'in_progress' || v === 'processing') return true;
  const wf = doc.workflowStatus != null ? String(doc.workflowStatus).trim() : '';
  if (wf) {
    const w = normalizeOrderStatus(wf);
    if (w !== 'draft' && w !== 'awaiting_tailor_selection' && !CUSTOMER_TRACK_TERMINAL.has(w)) {
      return true;
    }
  }
  const tid = doc.tailorId != null ? String(doc.tailorId).trim() : '';
  if (tid && !isPlaceholderTailorShopId(tid) && v === 'pending') return true;
  return false;
}

async function findTrackableOrdersForCustomer(customerId) {
  const cid = String(customerId || '').trim();
  if (!cid) return [];
  const orders = await Order.find({ customerId: cid }).sort({ updatedAt: -1 }).lean().exec();
  return orders.filter(isCustomerTrackableActiveOrderDoc);
}

/** Customer Track Order: latest accepted/active in-progress order for this customer */
app.get('/orders/customer/:customerId/active', requireAuth, requireRole(['customer']), async (req, res) => {
  const { customerId } = req.params;
  try {
    if (!authIdsMatch(customerId, req.authUser.id)) {
      log403PatchOrder(req, null, { customerId }, { phase: 'GET /orders/customer/:id/active' });
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const trackable = await findTrackableOrdersForCustomer(customerId);
    if (trackable.length === 0) {
      return res.status(404).json({ message: 'No active order.' });
    }
    const order =
      trackable.find((o) => o.isActive === true) ||
      trackable.find((o) => o.acceptedAt) ||
      trackable[0];
    return res.status(200).json(order);
  } catch (error) {
    console.error('FETCH ACTIVE CUSTOMER ORDER ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch active order.' });
  }
});

app.get('/orders/tailor/:tailorId', requireAuth, requireRole(['tailor']), async (req, res) => {
  const { tailorId } = req.params;
  try {
    const shop = await resolveTailorShopId(req);
    if (!shop || String(tailorId).trim() !== shop) {
      log403PatchOrder(req, null, { tailorId }, { phase: 'GET /orders/tailor/:id' });
      return res.status(403).json({ message: 'Forbidden.' });
    }
    console.log('FETCH TAILOR ORDERS', tailorId);
    const orders = await Order.find({ tailorId: String(tailorId) }).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    console.error('FETCH TAILOR ORDERS ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch tailor orders.' });
  }
});

app.get('/orders/:orderId', requireAuth, async (req, res) => {
  const { orderId } = req.params;
  const raw = orderId != null ? String(orderId).trim() : '';
  try {
    let order = null;
    if (raw && mongoose.Types.ObjectId.isValid(raw)) {
      order = await Order.findById(raw);
    }
    if (!order && raw) {
      order = await Order.findOne({ clientOrderId: raw });
    }
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    // Only the owning customer or assigned tailor can read.
    const cid = order.customerId != null ? String(order.customerId).trim() : '';
    const tid = order.tailorId != null ? String(order.tailorId).trim() : '';
    if (req.authUser.role === 'customer' && !customerOwnsOrder(req, cid, req.body)) {
      log403PatchOrder(req, order, req.body, { phase: 'GET /orders/:orderId' });
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (req.authUser.role === 'tailor') {
      const shop = await resolveTailorShopId(req);
      if (!shop) {
        log403PatchOrder(req, order, req.body, { phase: 'GET /orders/:orderId no shop' });
        return res.status(403).json({ message: 'Forbidden.' });
      }
      if (tid !== shop && !(isPlaceholderTailorIdForClaim(tid) || !tid)) {
        log403PatchOrder(req, order, req.body, { phase: 'GET /orders/:orderId tailor mismatch' });
        return res.status(403).json({ message: 'Forbidden.' });
      }
    }
    return res.status(200).json(order);
  } catch (error) {
    console.error('FETCH ORDER BY ID ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch order.' });
  }
});

/** Partial wizard / measurement updates — does not replace PUT workflow fields contract */
app.patch('/orders/:orderId', requireAuth, async (req, res) => {
  const paramId = req.params.orderId != null ? String(req.params.orderId).trim() : '';
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const updatePayload = {};
  if (b.customerName != null) updatePayload.customerName = String(b.customerName);
  if (b.customerPhone != null) updatePayload.customerPhone = String(b.customerPhone);
  if (b.customerId != null) updatePayload.customerId = String(b.customerId);
  if (b.garmentType != null) updatePayload.garmentType = String(b.garmentType);
  if (b.garmentCategory != null) updatePayload.garmentCategory = String(b.garmentCategory);
  if (b.measurements != null && typeof b.measurements === 'object') {
    updatePayload.measurements = b.measurements;
  }
  if (b.style != null && typeof b.style === 'object') {
    updatePayload.style = b.style;
  }
  if (b.notes != null && typeof b.notes === 'object') {
    updatePayload.notes = b.notes;
  }
  if (b.orderPayload != null) {
    updatePayload.orderPayload = b.orderPayload;
  }
  if (b.dueDate != null) {
    const d = new Date(b.dueDate);
    updatePayload.dueDate = Number.isNaN(d.getTime()) ? null : d;
  }
  if (b.source != null) updatePayload.source = String(b.source);
  if (b.clientOrderId != null) updatePayload.clientOrderId = String(b.clientOrderId);
  else if (b.orderId != null) updatePayload.clientOrderId = String(b.orderId);
  if (b.price != null) updatePayload.price = Number(b.price) || 0;
  if (b.isActive === true || b.isActive === false) {
    updatePayload.isActive = Boolean(b.isActive);
  }
  if (b.chatEnabled === true || b.chatEnabled === false) {
    updatePayload.chatEnabled = Boolean(b.chatEnabled);
  }
  if (b.acceptedAt != null) {
    const d = new Date(b.acceptedAt);
    updatePayload.acceptedAt = Number.isNaN(d.getTime()) ? new Date() : d;
  }
  if (b.status != null && String(b.status).trim() !== '') {
    updatePayload.status = normalizeOrderStatus(String(b.status));
  }
  if (b.workflowStatus != null && String(b.workflowStatus).trim() !== '' && updatePayload.status == null) {
    updatePayload.status = normalizeOrderStatus(String(b.workflowStatus));
  }
  if (b.currentStepIndex != null && Number.isFinite(Number(b.currentStepIndex))) {
    updatePayload.currentStepIndex = Math.max(0, Math.min(MAX_WORKFLOW_STEP_INDEX, Number(b.currentStepIndex)));
  }
  if (b.currentStep != null && Number.isFinite(Number(b.currentStep))) {
    updatePayload.currentStepIndex = Math.max(0, Math.min(MAX_WORKFLOW_STEP_INDEX, Number(b.currentStep)));
  }

  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ message: 'No updatable fields in body.' });
  }

  try {
    if (!req.authUser) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    Object.keys(updatePayload).forEach((k) => {
      if (updatePayload[k] === undefined) delete updatePayload[k];
    });
    const existing = await findOrderDocByParam(paramId);
    if (!existing) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    const tailorPatch = resolveTailorIdPatchDecision(existing, b, req.authUser);
    const explicitClaim = tailorPatch.explicitClaim;
    const patchAction = b.action != null ? String(b.action).trim() : '';

    if (req.authUser.role === 'customer') {
      const authId = normalizeAuthId(req.authUser.id);
      if (!authIdsMatch(existing.customerId, authId)) {
        log403PatchOrder(req, existing, b);
        return res.status(403).json({ message: 'Forbidden.' });
      }
      delete updatePayload.tailorId;

      if (patchAction === 'select_tailor') {
        const incomingTid = b.tailorId != null ? normalizeId(b.tailorId) : '';
        const existingTid = normalizeId(existing.tailorId);
        if (!incomingTid || !isRealTailorId(incomingTid)) {
          return res.status(400).json({ message: 'A valid tailor shop id is required.' });
        }
        if (existingTid && isRealTailorId(existingTid) && existingTid !== incomingTid) {
          return res.status(403).json({ message: 'This order is already assigned to another tailor.' });
        }
        updatePayload.tailorId = incomingTid;
        updatePayload.status = 'pending';
        updatePayload.workflowStatus = 'pending';
        updatePayload.isActive = false;
        updatePayload.chatEnabled = false;
      } else if (tailorPatch.shouldUpdateTailorId && tailorPatch.incomingTailorId) {
        updatePayload.tailorId = tailorPatch.incomingTailorId;
      }
      if (updatePayload.customerId != null && !authIdsMatch(updatePayload.customerId, authId)) {
        delete updatePayload.customerId;
      }
    } else if (req.authUser.role === 'tailor') {
      const shop = await resolveTailorShopId(req);
      const orderTid = normalizeId(existing.tailorId);

      if (patchAction === 'accept_order') {
        if (!shop || !orderTid || orderTid !== shop) {
          log403AcceptOrder(
            paramId,
            orderTid || '',
            shop || tailorShopFromAuth(req),
            b.tailorId != null ? normalizeAuthId(b.tailorId) : ''
          );
          return res.status(403).json({ message: 'Order belongs to another tailor.' });
        }
        updatePayload.tailorId = shop;
        updatePayload.status = 'accepted';
        updatePayload.workflowStatus = 'accepted';
        updatePayload.isActive = true;
        updatePayload.chatEnabled = true;
        updatePayload.acceptedAt = new Date();
        updatePayload.currentStepIndex = 0;
      } else if (patchAction === 'reject_order') {
        if (!shop || !orderTid || orderTid !== shop) {
          log403AcceptOrder(
            paramId,
            orderTid || '',
            shop || tailorShopFromAuth(req),
            b.tailorId != null ? normalizeAuthId(b.tailorId) : ''
          );
          return res.status(403).json({ message: 'Order belongs to another tailor.' });
        }
        updatePayload.tailorId = shop;
        updatePayload.status = 'rejected';
        updatePayload.workflowStatus = 'rejected';
        updatePayload.isActive = false;
        updatePayload.chatEnabled = false;
        updatePayload.rejectedAt = new Date();
        updatePayload.rejectedBy = shop;
        updatePayload.acceptedAt = null;
        if (b.rejectionReason != null) {
          updatePayload.rejectionReason = String(b.rejectionReason).trim().slice(0, 500);
        }
        updatePayload.currentStepIndex = 0;
      } else {
        const access = tailorMayPatchOrder(req, existing, b, tailorPatch);
        if (!access.ok) {
          log403PatchOrder(req, existing, b, { reason: access.reason });
          if (explicitClaim && access.reason === 'other_tailor') {
            log403AcceptOrder(
              paramId,
              access.orderTailorId || normalizeAuthId(existing.tailorId),
              access.loggedTailorId || tailorShopFromAuth(req),
              b.tailorId != null ? normalizeAuthId(b.tailorId) : ''
            );
            return res.status(403).json({ message: 'Order belongs to another tailor.' });
          }
          return res.status(403).json({ message: 'Forbidden.' });
        }
      }
    } else {
      log403PatchOrder(req, existing, b, { reason: 'invalid_role' });
      return res.status(403).json({ message: 'Forbidden.' });
    }

    const resolvedId = String(existing._id);

    if (req.authUser.role === 'tailor' && tailorPatch.shouldUpdateTailorId) {
      updatePayload.tailorId = tailorPatch.incomingTailorId;
    }

    if (updatePayload.isActive === true) {
      await Order.updateMany(
        { tailorId: String(existing.tailorId), _id: { $ne: existing._id } },
        { $set: { isActive: false } }
      );
    }

    const linkBeforeWrite = deriveOrderLinkagesForConversation(existing);
    if (linkBeforeWrite.customerId && updatePayload.customerId == null) {
      updatePayload.customerId = linkBeforeWrite.customerId;
    }
    if (linkBeforeWrite.tailorId && updatePayload.tailorId == null && b.tailorId == null) {
      const linked = normalizeId(linkBeforeWrite.tailorId);
      const existingTid = normalizeId(existing.tailorId);
      if ((!existingTid || isPlaceholderTailorIdForClaim(existingTid)) && linked && isRealTailorId(linked)) {
        updatePayload.tailorId = linked;
      }
    }

    if (patchAction === 'accept_order') {
      updatePayload.status = 'accepted';
      updatePayload.workflowStatus = 'accepted';
      if (updatePayload.currentStepIndex == null) {
        updatePayload.currentStepIndex = 0;
      }
    } else if (patchAction === 'reject_order') {
      updatePayload.status = 'rejected';
      updatePayload.workflowStatus = 'rejected';
      updatePayload.isActive = false;
      updatePayload.chatEnabled = false;
      updatePayload.acceptedAt = null;
      if (updatePayload.currentStepIndex == null) {
        updatePayload.currentStepIndex = 0;
      }
    } else {
      const unified = computeWorkflow({ ...orderDocToPlainForWorkflow(existing), ...updatePayload });
      updatePayload.status = unified.status;
      updatePayload.workflowStatus = unified.workflowStatus;
      updatePayload.currentStepIndex = unified.currentStepIndex;
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      resolvedId,
      { $set: updatePayload },
      { new: true, strict: false, runValidators: false }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    let persisted = await Order.findById(resolvedId).lean().exec();
    if (!persisted) {
      persisted =
        typeof updatedOrder.toObject === 'function'
          ? updatedOrder.toObject({ flattenMaps: true, virtuals: true })
          : updatedOrder;
    }

    emitMeasurementOrderToTailor(persisted);
    let payload;
    try {
      payload = buildWorkflowSocketPayload(persisted);
    } catch (buildErr) {
      console.error('[Socket Sync] PATCH /orders buildWorkflowSocketPayload failed', buildErr);
      const mid = persisted._id != null ? String(persisted._id).trim() : '';
      const coid = persisted.clientOrderId != null ? String(persisted.clientOrderId).trim() : '';
      const tid = persisted.tailorId != null ? String(persisted.tailorId).trim() : '';
      const st = persisted.status != null ? normalizeOrderStatus(String(persisted.status)) : 'pending';
      const wf =
        persisted.workflowStatus != null ? normalizeOrderStatus(String(persisted.workflowStatus)) : st;
      const csi = Number.isFinite(Number(persisted.currentStepIndex)) ? Number(persisted.currentStepIndex) : 0;
      const slim = {
        _id: mid,
        id: mid,
        tailorId: tid,
        status: st,
        workflowStatus: wf,
        currentStepIndex: csi,
        clientOrderId: coid,
      };
      payload = {
        orderId: mid,
        clientOrderId: coid,
        tailorId: tid,
        fullOrder: slim,
        order: slim,
        status: st,
        workflowStatus: wf,
        currentStepIndex: csi,
        updatedAt: new Date().toISOString(),
      };
    }

    try {
      const patchStatusRooms = [];
      const oid = payload.orderId != null ? String(payload.orderId).trim() : '';
      const clientOid = payload.clientOrderId != null ? String(payload.clientOrderId).trim() : '';
      if (oid) {
        patchStatusRooms.push(oid, `map_order:${oid}`);
      }
      if (clientOid && clientOid !== oid) {
        patchStatusRooms.push(clientOid, `map_order:${clientOid}`);
      }
      if (patchStatusRooms.length) {
        emitToRoomUnion(io, patchStatusRooms, 'order:statusUpdated', payload);
      }

      const tId = payload.tailorId != null && String(payload.tailorId).trim() !== '' ? String(payload.tailorId).trim() : '';
      const s = payload.status != null ? String(payload.status).trim() : '';
      const isReject =
        s === 'rejected' || s === 'declined' || s === 'cancelled' || s === 'canceled';
      const emitAccepted = shouldEmitOrderAcceptedOnPatch(existing, b) && Boolean(tId) && !isReject;

      if (emitAccepted) {
        const oidForChat = payload.orderId != null ? String(payload.orderId).trim() : '';
        const cust = persisted.customerId != null ? String(persisted.customerId).trim() : '';
        const ack = {
          orderId: payload.orderId,
          clientOrderId: payload.clientOrderId || '',
          tailorId: tId,
          status: payload.status,
          chatEnabled: isOrderDocChatEnabled(persisted),
          conversationId: oidForChat || '',
          customerId: cust,
        };
        const orderAcceptedRooms = [...patchStatusRooms];
        if (cust) {
          orderAcceptedRooms.push(cust);
          const uroom = userRoomName(cust);
          if (uroom && uroom !== cust) orderAcceptedRooms.push(uroom);
        }
        console.log('[Socket Sync] orderAccepted rooms', orderAcceptedRooms.filter(Boolean), 'customerId', cust || '(none)');
        emitToRoomUnion(io, orderAcceptedRooms, 'orderAccepted', ack);
      } else if (isReject) {
        const rej = {
          orderId: payload.orderId,
          clientOrderId: payload.clientOrderId || '',
          tailorId: tId,
          status: payload.status,
          rejectionReason:
            persisted.rejectionReason != null ? String(persisted.rejectionReason).trim() : '',
          rejectedAt:
            persisted.rejectedAt != null
              ? new Date(persisted.rejectedAt).toISOString()
              : new Date().toISOString(),
          rejectedBy:
            persisted.rejectedBy != null ? String(persisted.rejectedBy).trim() : tId,
        };
        const rejectRooms = [...patchStatusRooms];
        const cust = persisted.customerId != null ? String(persisted.customerId).trim() : '';
        if (cust) {
          rejectRooms.push(cust);
          const uroom = userRoomName(cust);
          if (uroom && uroom !== cust) rejectRooms.push(uroom);
        }
        emitToRoomUnion(io, rejectRooms, 'orderRejected', rej);
      }
    } catch (socketErr) {
      console.error('[Socket Sync] PATCH /orders emit error', socketErr);
    }

    try {
      const allowConv =
        patchAction === 'accept_order' ||
        (patchAction === 'select_tailor' && isRealTailorId(persisted.tailorId));
      if (allowConv) {
        await maybeEnsureConversationAfterOrderWrite(persisted, 'PATCH /orders', {
          allowTailorReassign: explicitClaim || patchAction === 'select_tailor',
        });
      }
      if (patchAction === 'accept_order') {
        const oid = String(persisted._id);
        const conv = await Conversation.findOneAndUpdate(
          { orderId: oid },
          { $set: { status: 'accepted', isActive: true, updatedAt: new Date() } },
          { new: true }
        );
        if (conv) {
          const cust = String(conv.customerId || persisted.customerId || '').trim();
          const tid = String(conv.tailorId || persisted.tailorId || '').trim();
          const convPayload = {
            conversationId: oid,
            orderId: oid,
            customerId: cust,
            tailorId: tid,
            status: 'accepted',
            isActive: true,
            lastMessage: conv.lastMessage,
            lastMessageAt: conv.lastMessageAt,
            unreadCustomer: conv.unreadCustomer,
            unreadTailor: conv.unreadTailor,
          };
          const convRooms = [oid, cust, userRoomName(cust), tid, userRoomName(tid)].filter(Boolean);
          emitToRoomUnion(io, convRooms, 'conversation:updated', convPayload);
        }
      }
    } catch (convErr) {
      console.error('[ChatSync] PATCH /orders conversation ensure failed', convErr);
    }

    console.log(
      '[Workflow Engine] PATCH /orders',
      String(persisted._id),
      persisted.status,
      persisted.workflowStatus,
      persisted.currentStepIndex
    );
    let responseBody =
      persisted && typeof persisted.toObject === 'function'
        ? persisted.toObject({ flattenMaps: true, virtuals: true })
        : persisted;
    try {
      responseBody = JSON.parse(JSON.stringify(responseBody));
    } catch (serializeErr) {
      console.error('[PATCH /orders] response JSON sanitize failed', serializeErr);
      responseBody = {
        _id: String(persisted._id),
        status: persisted.status,
        workflowStatus: persisted.workflowStatus,
        currentStepIndex: persisted.currentStepIndex,
        tailorId: persisted.tailorId,
        customerId: persisted.customerId,
        clientOrderId: persisted.clientOrderId,
      };
    }
    return res.status(200).json(responseBody);
  } catch (error) {
    console.error('ORDER PATCH ERROR', error && error.message);
    if (error && error.stack) console.error(error.stack);
    return res.status(500).json({ message: 'Unable to update order.' });
  }
});

app.put('/orders/:orderId', requireAuth, async (req, res) => {
  const { orderId } = req.params;
  const { status, review, customerReview } = req.body || {};
  if (!status && !review && !customerReview) {
    return res.status(400).json({ message: 'At least one field to update is required.' });
  }

  try {
    const updatePayload = {};
    if (status) {
      updatePayload.status = normalizeOrderStatus(status);
    }
    if (review && typeof review === 'object') {
      updatePayload.review = review;
    }
    if (customerReview && typeof customerReview === 'object') {
      updatePayload.customerReview = customerReview;
    }

    const rawId = orderId != null ? String(orderId).trim() : '';
    let resolvedMongoId = null;
    if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
      const exists = await Order.findById(rawId).select('_id').lean();
      if (exists) resolvedMongoId = String(exists._id);
    }
    if (!resolvedMongoId && rawId) {
      const byClient = await Order.findOne({ clientOrderId: rawId }).select('_id').lean();
      if (byClient) resolvedMongoId = String(byClient._id);
    }

    if (!resolvedMongoId) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const existingOrder = await Order.findById(resolvedMongoId);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    if (req.authUser.role === 'customer' && !customerOwnsOrder(req, existingOrder.customerId, req.body)) {
      log403PatchOrder(req, existingOrder, req.body, { phase: 'PUT /orders/:orderId' });
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (req.authUser.role === 'tailor') {
      const shop = await resolveTailorShopId(req);
      const tid = existingOrder.tailorId != null ? String(existingOrder.tailorId).trim() : '';
      if (!shop || tid !== shop) {
        log403PatchOrder(req, existingOrder, req.body, { phase: 'PUT /orders/:orderId tailor' });
        return res.status(403).json({ message: 'Forbidden.' });
      }
    }
    const unified = computeWorkflow({ ...orderDocToPlainForWorkflow(existingOrder), ...updatePayload });
    updatePayload.status = unified.status;
    updatePayload.workflowStatus = unified.workflowStatus;
    updatePayload.currentStepIndex = unified.currentStepIndex;

    const updatedOrder = await Order.findByIdAndUpdate(
      resolvedMongoId,
      { $set: updatePayload },
      { new: true, strict: false }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    emitMeasurementOrderToTailor(updatedOrder);
    const payload = buildWorkflowSocketPayload(updatedOrder);
    io.to(payload.orderId).emit('order:statusUpdated', payload);
    console.log('[Socket Sync] order:statusUpdated', payload.orderId, payload.status, payload.currentStepIndex);

    console.log('ORDER STATUS UPDATED', {
      orderId: updatedOrder._id.toString(),
      status: updatedOrder.status || 'unchanged',
    });
    return res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('ORDER STATUS UPDATE ERROR', error);
    return res.status(500).json({ message: 'Unable to update order status.' });
  }
});

/** Map matching: lightweight payloads; client merges full tailor rows by id. */
const MAP_INTEREST_STAGGER_MS = 650;

function orderIdFromOrderChatConversationId(conversationId) {
  const raw = String(conversationId || '').trim();
  if (!raw) return '';
  if (raw.startsWith('order_')) return raw.slice('order_'.length).trim();
  return raw;
}

function isOrderDocChatEnabled(doc) {
  if (!doc) return false;
  if (doc.chatEnabled === false) return false;
  const tid = doc.tailorId != null ? String(doc.tailorId).trim() : '';
  if (!tid || isPlaceholderTailorShopId(tid)) return false;
  const v = normalizeOrderStatus(doc.status);
  if (v === 'rejected' || v === 'declined' || v === 'cancelled' || v === 'canceled') return false;
  if (v === 'awaiting_tailor_selection' || v === 'draft') return false;
  if (doc.isActive === true || doc.acceptedAt) return true;
  return v === 'accepted' || v === 'active';
}

/** Conversation upsert: order top-level ids only (no session/selected tailor). */
function conversationLinkagesFromOrderDoc(orderDoc) {
  if (!orderDoc) return { oid: '', customerId: '', tailorId: '', plain: null };
  const plain =
    typeof orderDoc.toObject === 'function'
      ? orderDoc.toObject({ depopulate: true })
      : { ...orderDoc };
  const oid =
    plain._id != null
      ? stringifyOrderIdField(plain._id)
      : plain.id != null
        ? stringifyOrderIdField(plain.id)
        : '';
  const customerId = stringifyOrderIdField(plain.customerId);
  const tailorId = stringifyOrderIdField(plain.tailorId);
  return { oid, customerId, tailorId, plain };
}

function resolveParticipantsFromOrder(doc) {
  const cid = String(doc?.customerId || '').trim();
  const tid = String(doc?.tailorId || '').trim();
  const orderId = doc?._id != null ? String(doc._id) : '';
  return { customerId: cid, tailorId: tid, orderId };
}

function resolveExpectedReceiverId(senderId, customerId, tailorId) {
  const s = String(senderId || '').trim();
  const c = String(customerId || '').trim();
  const t = String(tailorId || '').trim();
  if (!s || !c || !t) return '';
  if (s === c) return t;
  if (s === t) return c;
  return '';
}

function senderIsOrderParticipant(doc, senderId) {
  const s = String(senderId || '').trim();
  const { customerId, tailorId } = resolveParticipantsFromOrder(doc);
  return Boolean(s && (authIdsMatch(s, customerId) || s === tailorId));
}

async function verifySocketOrderChatAccess(socket, conversationIdRaw) {
  if (!socket.authUser) return null;
  const orderKey = orderIdFromOrderChatConversationId(conversationIdRaw);
  if (!orderKey) return null;
  const doc = await findOrderDocByParam(orderKey);
  if (!doc || !isOrderDocChatEnabled(doc)) return null;
  const u = socket.authUser;
  const cid = String(doc.customerId || '').trim();
  const tid = String(doc.tailorId || '').trim();
  if (u.role === 'customer') {
    if (!authIdsMatch(cid, u.id)) return null;
  } else if (u.role === 'tailor') {
    let shop = u.tailorShopId != null ? String(u.tailorShopId).trim() : '';
    if (!shop) {
      try {
        const tp = await TailorProfile.findOne({ userId: u.id }).select('tailorShopId').lean();
        if (tp && tp.tailorShopId) shop = String(tp.tailorShopId).trim();
      } catch {
        /* ignore */
      }
    }
    if (!shop || tid !== shop) return null;
  } else {
    return null;
  }
  return doc;
}

function userRoomName(userId) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) return '';
  if (id.startsWith('user:')) return id;
  return `user:${id}`;
}

function deriveOrderLinkagesForConversation(orderDoc) {
  if (!orderDoc) {
    return { oid: '', customerId: '', tailorId: '', plain: null };
  }
  const plain =
    typeof orderDoc.toObject === 'function'
      ? orderDoc.toObject({ depopulate: true })
      : { ...orderDoc };
  const oid =
    plain._id != null
      ? stringifyOrderIdField(plain._id)
      : plain.id != null
        ? stringifyOrderIdField(plain.id)
        : '';
  let customerId = stringifyOrderIdField(plain.customerId);
  let tailorId = stringifyOrderIdField(plain.tailorId);
  const payload = plain.orderPayload && typeof plain.orderPayload === 'object' ? plain.orderPayload : null;
  if (!customerId && payload) {
    const p =
      payload.customerId ??
      payload.customer?.id ??
      payload.customer?._id ??
      payload.userId ??
      payload.user?.id;
    if (p != null) customerId = stringifyOrderIdField(p);
  }
  if (!customerId && payload?.customer && typeof payload.customer === 'object') {
    const p = payload.customer.id ?? payload.customer._id ?? payload.customer.customerId;
    if (p != null) customerId = stringifyOrderIdField(p);
  }
  const topTailor = stringifyOrderIdField(plain.tailorId);
  if (topTailor) {
    tailorId = topTailor;
  }
  return { oid, customerId, tailorId, plain };
}

async function ensureConversationForOrder(orderDoc, options = {}) {
  const allowTailorReassign = Boolean(options && options.allowTailorReassign);
  if (!orderDoc) {
    console.warn('[ensureConversationForOrder] missing orderDoc');
    return null;
  }
  const { oid, customerId: cidRaw, tailorId: tidRaw, plain } = conversationLinkagesFromOrderDoc(orderDoc);
  const customerId = cidRaw ? String(cidRaw).trim() : '';
  const tailorId = tidRaw ? String(tidRaw).trim() : '';
  if (!oid) {
    console.warn('[ensureConversationForOrder] missing order _id', {
      keys: plain && typeof plain === 'object' ? Object.keys(plain) : [],
    });
    return null;
  }
  if (!customerId || !tailorId) {
    console.warn('[ensureConversationForOrder] incomplete linkage — cannot upsert Conversation', {
      orderId: oid,
      customerId: customerId || '(missing)',
      tailorId: tailorId || '(missing)',
      status: plain?.status,
      topCustomer: plain?.customerId,
      topTailor: plain?.tailorId,
      hasOrderPayload: Boolean(plain?.orderPayload),
    });
    return null;
  }
  if (isPlaceholderTailorShopId(tailorId)) {
    console.warn('[ensureConversationForOrder] skip placeholder tailor', { orderId: oid, tailorId });
    return null;
  }

  const internal = normalizeOrderStatus(plain?.status);
  let status = internal === 'completed' ? 'completed' : 'active';
  if (internal === 'accepted' || plain?.isActive === true || plain?.acceptedAt) {
    status = 'accepted';
  }

  let existing = null;
  try {
    existing = await Conversation.findOne({ orderId: oid }).lean();
  } catch (e) {
    console.error('[ensureConversationForOrder] findOne', e);
  }

  const lastMessage = existing && existing.lastMessage != null ? String(existing.lastMessage) : '';
  let lastMessageAt = null;
  if (existing && existing.lastMessageAt != null) {
    const d =
      existing.lastMessageAt instanceof Date
        ? existing.lastMessageAt
        : new Date(existing.lastMessageAt);
    lastMessageAt = Number.isNaN(d.getTime()) ? null : d;
  }
  const unreadCustomer = Math.max(0, Number(existing?.unreadCustomer ?? 0)) || 0;
  const unreadTailor = Math.max(0, Number(existing?.unreadTailor ?? 0)) || 0;

  const op = plain.orderPayload && typeof plain.orderPayload === 'object' ? plain.orderPayload : null;
  const wizardTailorDisplay =
    op && typeof op.assignedTailorDisplayName === 'string' && op.assignedTailorDisplayName.trim()
      ? String(op.assignedTailorDisplayName).trim()
      : '';
  const nestedCustomerName =
    op && op.customer && typeof op.customer === 'object' && typeof op.customer.name === 'string'
      ? String(op.customer.name).trim()
      : '';

  let tailorDisplayName = String(existing?.tailorName || '').trim();
  if (!tailorDisplayName && wizardTailorDisplay) tailorDisplayName = wizardTailorDisplay;
  if (!tailorDisplayName && tailorId) {
    try {
      const tp = await TailorProfile.findOne({ tailorShopId: tailorId }).select('shopName displayName').lean();
      if (tp) {
        // Match public tailor list: displayName (card / person) first, then shop name.
        tailorDisplayName = String(
          (tp.displayName && String(tp.displayName).trim()) || tp.shopName || ''
        ).trim();
      }
    } catch (e) {
      /* ignore */
    }
  }

  const customerDisplayName = String(
    plain?.customerName || nestedCustomerName || existing?.customerName || ''
  ).trim();

  const participants = [customerId, tailorId].filter(Boolean);
  const orderIsActive = plain?.isActive === true;
  const full = {
    conversationId: oid,
    orderId: oid,
    customerId,
    tailorId,
    participants,
    customerName: customerDisplayName,
    tailorName: tailorDisplayName,
    garmentType: String(plain?.garmentType || existing?.garmentType || '').trim(),
    status,
    isActive: orderIsActive,
    lastMessage,
    lastMessageAt,
    unreadCustomer,
    unreadTailor,
  };

  console.log('[conversation source of truth]', {
    orderId: oid,
    customerId,
    tailorId,
    participants,
  });

  try {
    const doc = await Conversation.findOneAndUpdate(
      { orderId: oid },
      { $set: { ...full, updatedAt: new Date() } },
      { new: true, upsert: true, strict: false, setDefaultsOnInsert: true }
    );
    console.log('[ensureConversationForOrder] upsert OK', {
      orderId: oid,
      customerId,
      tailorId,
      conversationId: doc?.conversationId,
    });
    return doc;
  } catch (e) {
    console.error('[ensureConversationForOrder] upsert failed', { orderId: oid, customerId, tailorId, err: e });
    return null;
  }
}

/**
 * Run after Order PATCH/PUT when linkage may be complete (idempotent upsert).
 */
async function maybeEnsureConversationAfterOrderWrite(orderDoc, contextLabel = 'order-write', options = {}) {
  const allowTailorReassign = Boolean(options && options.allowTailorReassign);
  if (!orderDoc) {
    console.warn('[ChatSync] maybeEnsureConversationAfterOrderWrite: missing doc', contextLabel);
    return null;
  }
  const link = deriveOrderLinkagesForConversation(orderDoc);
  const st = normalizeOrderStatus(orderDoc.status);
  const dead = ['rejected', 'declined', 'cancelled', 'canceled'].includes(st);
  if (dead) {
    console.log('[ChatSync] skip conversation (terminal negative status)', contextLabel, link.oid, st);
    return null;
  }
  if (!link.customerId || !link.tailorId) {
    console.warn('[ChatSync] skip conversation (incomplete linkage after write)', contextLabel, {
      orderId: link.oid || '(no oid)',
      customerId: link.customerId || '(missing)',
      tailorId: link.tailorId || '(missing)',
    });
    return null;
  }
  if (isPlaceholderTailorShopId(link.tailorId)) {
    console.log('[ChatSync] skip conversation (placeholder tailor)', contextLabel, link.oid, link.tailorId);
    return null;
  }
  try {
    const doc = await ensureConversationForOrder(orderDoc, { allowTailorReassign });
    if (!doc) {
      console.warn('[ChatSync] Conversation upsert returned null', contextLabel, link.oid);
    }
    return doc;
  } catch (e) {
    console.error('[ChatSync] Conversation upsert threw', contextLabel, link.oid, e);
    return null;
  }
}

io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || '';
    const fakeReq = { headers: { cookie: cookieHeader } };
    socket.authUser = await loadAuthedUser(fakeReq);
  } catch (e) {
    console.error('[socket] auth middleware', e);
    socket.authUser = null;
  }
  next();
});

io.on('connection', (socket) => {
  socket.on('tailor:selected', (data = {}) => {
    try {
      const tailorId = data.tailorId != null ? String(data.tailorId).trim() : '';
      const customerId = data.customerId != null ? String(data.customerId).trim() : '';
      const orderId = data.orderId != null ? String(data.orderId).trim() : '';
      if (!tailorId || !orderId) return;

      io.to(tailorId).emit('tailor:popup', {
        type: 'NEW_ORDER_REQUEST',
        orderId,
        customerId,
        location: data.location || null,
        garmentType: data.garmentType || data.dressType || '—',
        budget: data.budget != null ? String(data.budget) : '—',
        message: 'A customer selected you for an order',
      });
    } catch (e) {
      console.error('[socket] tailor:selected handler', e);
    }
  });

  socket.on('newOrder', (data = {}) => {
    const orderId =
      data.orderId != null && String(data.orderId).trim() !== ''
        ? String(data.orderId).trim()
        : `map_${Date.now()}`;
    socket.join(`map_order:${orderId}`);
    console.log('[map] newOrder', orderId);
    const dueDateRaw =
      data.dueDate != null && String(data.dueDate).trim() !== '' ? String(data.dueDate).trim() : '';
    const notesRaw =
      data.notes != null && String(data.notes).trim() !== '' ? String(data.notes).trim() : '';
    const tailorBroadcast = {
      orderId,
      distance:
        data.radiusKm != null && data.radiusKm !== ''
          ? `Within ${data.radiusKm} km`
          : data.distance != null && String(data.distance).trim() !== ''
            ? String(data.distance).trim()
            : '—',
      dressType:
        data.garmentType || data.dressType || data.garment || '—',
      budget:
        data.budget != null && String(data.budget).trim() !== ''
          ? String(data.budget).trim()
          : '—',
      dueDate: dueDateRaw,
      notes: notesRaw,
    };
    // Notify every connected client (map page does not listen). Ensures tailor tab receives
    // the alert even when debugging from one machine; broadcast.emit omits only the sender.
    io.emit('newOrder', tailorBroadcast);
  });

  socket.on('interest', (data = {}) => {
    const orderId = data.orderId != null ? String(data.orderId).trim() : '';
    const tailorId = data.tailorId != null ? String(data.tailorId).trim() : '';
    if (!orderId || !tailorId) return;
    console.log('[map] interest', orderId, tailorId);
    io.to(`map_order:${orderId}`).emit('tailorInterested', {
      orderId,
      tailorId,
      tailor: { id: tailorId },
    });
  });

  socket.on('tailorExpressInterest', (payload = {}) => {
    const orderId = payload.orderId != null ? String(payload.orderId).trim() : '';
    const tailor = payload.tailor && typeof payload.tailor === 'object' ? payload.tailor : null;
    if (!orderId || !tailor) return;
    io.to(`map_order:${orderId}`).emit('tailorInterested', {
      orderId,
      tailorId: String(tailor.id ?? '').trim(),
      tailor,
    });
  });

  socket.on('selectTailor', (data = {}) => {
    const orderId = data.orderId != null ? String(data.orderId).trim() : '';
    const tailorId = data.tailorId != null ? String(data.tailorId).trim() : '';
    console.log('[map] selectTailor', orderId, tailorId);
    if (orderId) {
      io.to(`map_order:${orderId}`).emit('mapSelectionAck', { orderId, tailorId });
    }
  });

  socket.on('join_user', ({ userId } = {}) => {
    const room = userId != null ? String(userId).trim() : '';
    if (!room) return;
    console.log('JOIN USER', room);
    socket.join(room);
    const uroom = userRoomName(room);
    if (uroom && uroom !== room) socket.join(uroom);
  });

  socket.on('join_conversation', async ({ conversationId } = {}) => {
    const raw = conversationId != null ? String(conversationId).trim() : '';
    if (!raw) return;
    const doc = await verifySocketOrderChatAccess(socket, raw);
    if (!doc) return;
    const canonical = String(doc._id);
    const room = `conversation:${canonical}`;
    console.log('[ChatSync Socket] joined room', room);
    socket.join(room);
  });

  socket.on('leave_conversation', ({ conversationId } = {}) => {
    const raw = conversationId != null ? String(conversationId).trim() : '';
    if (!raw) return;
    const orderKey = orderIdFromOrderChatConversationId(raw);
    if (!orderKey) return;
    void (async () => {
      const doc = await findOrderDocByParam(orderKey);
      if (!doc) return;
      const room = `conversation:${String(doc._id)}`;
      socket.leave(room);
      console.log('[ChatSync Socket] left room', room);
    })().catch(() => {});
  });

  socket.on('typing:start', ({ conversationId } = {}) => {
    const raw = conversationId != null ? String(conversationId).trim() : '';
    if (!raw) return;
    void (async () => {
      const doc = await verifySocketOrderChatAccess(socket, raw);
      if (!doc) return;
      const canonical = String(doc._id);
      io.to(`conversation:${canonical}`).emit('typing:start', { conversationId: canonical, userId: socket.authUser?.id });
    })().catch(() => {});
  });

  socket.on('typing:stop', ({ conversationId } = {}) => {
    const raw = conversationId != null ? String(conversationId).trim() : '';
    if (!raw) return;
    void (async () => {
      const doc = await verifySocketOrderChatAccess(socket, raw);
      if (!doc) return;
      const canonical = String(doc._id);
      io.to(`conversation:${canonical}`).emit('typing:stop', { conversationId: canonical, userId: socket.authUser?.id });
    })().catch(() => {});
  });

  socket.on('messages:read', async ({ conversationId } = {}) => {
    const raw = conversationId != null ? String(conversationId).trim() : '';
    if (!raw) return;
    const doc = await verifySocketOrderChatAccess(socket, raw);
    if (!doc) return;
    const canonical = String(doc._id);
    const u = socket.authUser;
    try {
      const c = await Conversation.findOne({ orderId: canonical });
      if (!c) return;
      if (u.role === 'customer') c.unreadCustomer = 0;
      if (u.role === 'tailor') c.unreadTailor = 0;
      c.lastMessageAt = c.lastMessageAt || new Date();
      await c.save();
      io.to(`conversation:${canonical}`).emit('messages:read', {
        conversationId: canonical,
        unreadCustomer: c.unreadCustomer,
        unreadTailor: c.unreadTailor,
      });
    } catch (e) {
      console.error('messages:read', e);
    }
  });

  socket.on('join_order_room', (orderId) => {
    const room = orderId != null ? String(orderId).trim() : '';
    if (!room) return;
    socket.join(room);
    socket.join(`map_order:${room}`);
  });

  socket.on('order:selected', (data = {}) => {
    const orderId = data.orderId != null ? String(data.orderId).trim() : '';
    if (!orderId) return;
    socket.join(orderId);
    io.to(orderId).emit('order:sync', { orderId });
  });

  socket.on('order:statusUpdated', async (data = {}) => {
    await applySocketOrderStatusUpdate(socket, data, false);
  });

  socket.on('order:active', (data = {}) => {
    const orderId = data.orderId != null ? String(data.orderId).trim() : '';
    if (!orderId) return;
    socket.join(orderId);
    io.to(orderId).emit('order:sync', { orderId });
  });

  socket.on('order:statusUpdate', async (data = {}) => {
    console.log('[SERVER] status update:', data);
    await applySocketOrderStatusUpdate(socket, data, true);
  });

  socket.on('measurement:review', (payload = {}) => {
    console.log('[SERVER] measurement:review received:', payload?.wizardData?.image);

    try {
      console.log('[SERVER] Payload size:', JSON.stringify(payload).length);
    } catch (e) {
      console.error('[SERVER] Failed to calculate payload size', e);
    }

    const rawOrderId = payload.orderId != null ? String(payload.orderId).trim() : '';
    if (!rawOrderId) {
      emitMeasurementReviewedToTailorRoom(io, payload);
      return;
    }
    void (async () => {
      const doc = await findOrderDocByParam(rawOrderId);
      const normalized = buildWorkflowSocketPayload(doc, rawOrderId);
      const out = {
        ...payload,
        orderId: normalized.orderId,
        fullOrder: normalized.fullOrder,
        status: normalized.status,
        workflowStatus: normalized.workflowStatus,
        currentStepIndex: normalized.currentStepIndex,
        updatedAt: normalized.updatedAt,
      };
      console.log('[Socket Sync] measurement:reviewed', out.orderId, out.status, out.currentStepIndex);
      emitMeasurementReviewedToTailorRoom(io, out);
    })().catch((e) => {
      console.error('[Socket Sync] measurement:reviewed', e);
      emitMeasurementReviewedToTailorRoom(io, payload);
    });
  });

  socket.on('request_history', async ({ conversationId } = {}) => {
    const cid = conversationId != null ? String(conversationId).trim() : '';
    if (!cid) return;
    const doc = await verifySocketOrderChatAccess(socket, cid);
    if (!doc) {
      socket.emit('chat_history', { messages: [] });
      return;
    }
    try {
      const canonical = String(doc._id);
      const variants = [...new Set([canonical, `order_${canonical}`, cid])];
      console.log('FETCHING CHAT HISTORY FROM DB', canonical);
      const history = await Message.find({ conversationId: { $in: variants } }).sort({ timestamp: 1 }).lean();
      socket.emit('chat_history', { messages: history });
    } catch (error) {
      console.error('REQUEST_HISTORY ERROR', error);
      socket.emit('chat_history', { messages: [] });
    }
  });

  socket.on('send_message', async (payload = {}) => {
    const senderId = String(payload?.senderId ?? '').trim();
    const clientReceiverId = String(payload?.receiverId ?? '').trim();
    const conversationId = String(payload?.conversationId ?? '').trim();
    const content = String(payload?.content ?? payload?.text ?? '').trim();
    const { timestamp, status } = payload;
    if (!senderId || !conversationId || !content) {
      console.warn('SEND_MESSAGE rejected (missing field)', {
        hasSender: !!senderId,
        hasConv: !!conversationId,
        hasContent: !!content,
      });
      return;
    }

    try {
      const doc = await verifySocketOrderChatAccess(socket, conversationId);
      if (!doc) {
        console.warn('SEND_MESSAGE rejected (unauthorized or chat not enabled)');
        return;
      }
      const { customerId: orderCustomerId, tailorId: orderTailorId } = resolveParticipantsFromOrder(doc);
      if (!senderIsOrderParticipant(doc, senderId)) {
        console.warn('[chat] participants mismatch — sender not on order', {
          senderId,
          orderCustomerId,
          orderTailorId,
          conversationId: canonicalOrderIdFromOrderChatConversationId(conversationId),
        });
        return;
      }

      const expected = resolveExpectedReceiverId(senderId, orderCustomerId, orderTailorId);
      if (!expected) {
        console.warn('[chat] participants mismatch — cannot compute receiver', {
          senderId,
          orderCustomerId,
          orderTailorId,
          conversationId: canonicalOrderIdFromOrderChatConversationId(conversationId),
        });
        return;
      }
      let finalReceiverId = expected;
      if (clientReceiverId && clientReceiverId !== expected) {
        console.log('[chat] corrected stale receiverId', {
          from: clientReceiverId,
          to: expected,
          conversationId: canonicalOrderIdFromOrderChatConversationId(conversationId),
        });
      }

      const ts = timestamp ? new Date(timestamp) : new Date();
      if (Number.isNaN(ts.getTime())) {
        return;
      }
      const canonical = String(doc._id);
      const savedMessage = await Message.create({
        senderId,
        receiverId: finalReceiverId,
        conversationId: canonical,
        content,
        timestamp: ts,
        status: status || 'sent',
      });

      const message = {
        id: savedMessage._id.toString(),
        senderId: String(savedMessage.senderId),
        receiverId: String(savedMessage.receiverId),
        conversationId: String(savedMessage.conversationId),
        content: String(savedMessage.content),
        timestamp: savedMessage.timestamp?.toISOString
          ? savedMessage.timestamp.toISOString()
          : String(savedMessage.timestamp),
        status: String(savedMessage.status || 'sent'),
      };

      console.log('DB MESSAGE SAVED', message.id);
      console.log('EMITTING MESSAGE', {
        senderId: message.senderId,
        receiverId: message.receiverId,
        conversationId: message.conversationId,
      });
      const convRoom = `conversation:${canonical}`;
      const customerUserRoom = userRoomName(orderCustomerId);
      const tailorUserRoom = userRoomName(orderTailorId);
      console.log('EMITTING TO CONVERSATION ROOM', convRoom);
      io.to(convRoom).emit('message_received', message);
      if (customerUserRoom) io.to(customerUserRoom).emit('message_received', message);
      if (tailorUserRoom) io.to(tailorUserRoom).emit('message_received', message);
      if (orderCustomerId) io.to(orderCustomerId).emit('message_received', message);
      if (orderTailorId) io.to(orderTailorId).emit('message_received', message);
      try {
        let convo = await Conversation.findOne({ orderId: canonical });
        if (!convo) {
          console.warn('[send_message] Conversation missing; ensuring from order', canonical);
          await ensureConversationForOrder(doc);
          convo = await Conversation.findOne({ orderId: canonical });
        }
        if (convo) {
          convo.lastMessage = String(message.content || '').slice(0, 400);
          convo.lastMessageAt = new Date(message.timestamp);
          if (socket.authUser?.role === 'customer') convo.unreadTailor = Math.max(0, Number(convo.unreadTailor || 0) + 1);
          if (socket.authUser?.role === 'tailor') convo.unreadCustomer = Math.max(0, Number(convo.unreadCustomer || 0) + 1);
          convo.status = normalizeOrderStatus(doc.status) === 'completed' ? 'completed' : convo.status || 'active';
          await convo.save();
          io.to(convRoom).emit('conversation:updated', {
            conversationId: canonical,
            lastMessage: convo.lastMessage,
            lastMessageAt: convo.lastMessageAt,
            unreadCustomer: convo.unreadCustomer,
            unreadTailor: convo.unreadTailor,
            status: convo.status,
            customerId: String(convo.customerId || '').trim(),
            tailorId: String(convo.tailorId || '').trim(),
            orderId: canonical,
          });
          const notifyRoom =
            socket.authUser?.role === 'customer' ? userRoomName(doc.tailorId) : userRoomName(doc.customerId);
          if (notifyRoom) {
            io.to(notifyRoom).emit('new_notification', {
              conversationId: canonical,
              senderId,
              content: message.content,
              timestamp: message.timestamp,
              type: 'new_message',
            });
          }
        }
      } catch (e) {
        console.error('Conversation update after send_message', e);
      }
    } catch (error) {
      console.error('SEND_MESSAGE ERROR', error);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  verifySmtpOnStartup().catch((err) => {
    console.error('[email] SMTP startup verify error', err);
  });
});