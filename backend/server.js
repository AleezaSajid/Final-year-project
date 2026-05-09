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
const TailorProfile = require('./models/TailorProfile');
const Message = require('./models/Message');
const Order = require('./models/Order');
const Testimonial = require('./models/Testimonial');
const { sendMailSafe } = require('./email/mailer');
const { makeWelcomeEmail } = require('./email/templates/welcomeEmail');
const { makeOtpEmail } = require('./email/templates/otpEmail');

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

async function persistOtpAndSendEmail(userDoc) {
  const otp = generateSixDigitOtp();
  userDoc.emailOtpHash = hashEmailOtp(userDoc.email, otp);
  userDoc.emailOtpExpiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);
  await userDoc.save();
  const tpl = makeOtpEmail({
    name: userDoc.fullName,
    otp,
    expiresMinutes: Math.floor(EMAIL_OTP_TTL_MS / 60000),
  });
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || '';
  await sendMailSafe({
    from,
    to: String(userDoc.email).trim().toLowerCase(),
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
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
  if (role === 'tailor') {
    const tp = await TailorProfile.findOne({ userId: user.id }).select('tailorShopId').lean();
    if (tp && tp.tailorShopId) tailorShopId = String(tp.tailorShopId).trim();
  }
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role,
    ...(tailorShopId ? { tailorShopId } : {}),
  };
}

function requireAuth(req, res, next) {
  void (async () => {
    try {
      const u = await loadAuthedUser(req);
      if (!u) {
        clearSessionCookie(res);
        return res.status(401).json({ message: 'Not authenticated.' });
      }
      req.authUser = u;
      return next();
    } catch (e) {
      console.error('[auth] requireAuth error', e);
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Not authenticated.' });
    }
  })();
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
    try {
      const r = await User.updateMany(
        { $or: [{ isVerified: { $exists: false } }, { isVerified: null }] },
        { $set: { isVerified: true } }
      );
      if (r.modifiedCount) console.log('[auth] isVerified legacy migration:', r.modifiedCount);
    } catch (e) {
      console.error('[auth] isVerified migration error', e);
    }
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

async function registerUser(req, res) {
  const body = req.body || {};

  // Debug + safety: needed for multipart/form-data (FormData) submissions.
  console.log("BODY RECEIVED:", body);
  console.log("FILE RECEIVED:", req.file);

  const fullName = String(body.fullName || body.name || "").trim();
  const email = String(body.email || "").trim();
  const password = String(body.password || "").trim();
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

  try {
    const normalizedEmail = String(email).toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.', message: 'Email already registered.' });
    }

    const nextUserId = (await User.countDocuments()) + 1;
    const verifyToken = crypto.randomBytes(24).toString('hex');
    const verifyExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    const created = await User.create({
      id: nextUserId,
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      password,
      role,
      phone: String(body.phone || '').trim(),
      address: String(body.address || '').trim(),
      experience: String(body.experience || '').trim(),
      emailVerified: false,
      isVerified: false,
      emailOtpHash: '',
      emailOtpExpiresAt: null,
      emailVerifyToken: verifyToken,
      emailVerifyTokenExpiresAt: verifyExpiresAt,
    });

    let tailorShopId = null;
    if (role === 'tailor') {
      tailorShopId = `T-U${created.id}`;
      const shopName = String(body.shopName || '').trim();
      const city = String(body.city || '').trim();
      const specialty = String(body.specialty || '').trim();
      const latRaw = body.lat != null ? String(body.lat).trim() : '';
      const lngRaw = body.lng != null ? String(body.lng).trim() : '';
      const lat = latRaw !== '' ? Number(latRaw) : NaN;
      const lng = lngRaw !== '' ? Number(lngRaw) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({
          error: 'Valid location coordinates (lat/lng) are required.',
          message: 'Valid location coordinates (lat/lng) are required.',
        });
      }
      const experienceYears = Math.max(0, parseInt(String(body.experienceYears || '0'), 10) || 0);
      const priceStart = Math.max(0, parseInt(String(body.priceStart || '1500'), 10) || 1500);
      const deliveryDays = Math.max(1, parseInt(String(body.deliveryDays || '7'), 10) || 7);
      try {
        const avatarPath = req.file ? `/uploads/${req.file.filename}` : '';
        await TailorProfile.create({
          userId: created.id,
          email: normalizedEmail,
          tailorShopId,
          shopName,
          displayName: String(fullName).trim(),
          city,
          address: String(body.address || '').trim(),
          location: { type: 'Point', coordinates: [lng, lat] },
          specialty,
          bio: String(body.bio || '').trim(),
          skillsNotes: String(body.experience || '').trim(),
          experienceYears,
          priceStart,
          deliveryDays,
          imageUrl: avatarPath || String(body.imageUrl || '').trim(),
          rating: 4.7,
          availability: 'available',
          published: true,
        });
      } catch (profileErr) {
        console.error('TAILOR PROFILE CREATE ERROR', profileErr);
        await User.deleteOne({ _id: created._id });
        return res.status(500).json({
          error: 'Could not create tailor profile.',
          message: 'Could not create tailor profile. Please try again.',
        });
      }
    }

    const userOut = {
      id: created.id,
      fullName: created.fullName,
      email: created.email,
      role: created.role || 'customer',
    };
    if (tailorShopId) userOut.tailorShopId = tailorShopId;

    try {
      await persistOtpAndSendEmail(created);
    } catch (e) {
      console.error('[email] OTP send error', e);
      if (role === 'tailor') {
        await TailorProfile.deleteOne({ userId: created.id }).catch(() => {});
      }
      await User.deleteOne({ _id: created._id });
      return res.status(500).json({
        error: 'Could not send verification email. Please try again.',
        message: 'Could not send verification email. Please try again.',
      });
    }

    // Welcome + link verification (optional) after OTP in a follow-up email is omitted here to avoid duplicate noise.

    return res.status(201).json({
      message: 'Account created. Enter the verification code we emailed you.',
      needsVerification: true,
      user: userOut,
    });
  } catch (error) {
    console.error('SIGNUP ERROR', error);
    return res.status(500).json({ error: 'Unable to create account right now.', message: 'Unable to create account right now.' });
  }
}

app.post('/signup', upload.single('avatar'), registerUser);
app.post('/api/register', upload.single('avatar'), registerUser);

async function buildUserOutForSession(user) {
  if (!user) return null;
  let tailorShopId = null;
  if (user.role === 'tailor') {
    const tp = await TailorProfile.findOne({ userId: user.id }).select('tailorShopId').lean();
    if (tp && tp.tailorShopId) tailorShopId = String(tp.tailorShopId).trim();
  }
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role || 'customer',
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

app.post('/api/auth/send-otp', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (user.isVerified === true) {
      return res.status(400).json({ message: 'Account already verified.' });
    }
    await persistOtpAndSendEmail(user);
    return res.json({ ok: true, message: 'Verification code sent.' });
  } catch (e) {
    console.error('POST /api/auth/send-otp', e);
    return res.status(500).json({ message: 'Could not send verification code.' });
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
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (user.isVerified === true) {
      const userOut = await buildUserOutForSession(user);
      setSessionCookie(res, userOut);
      return res.json({ ok: true, message: 'Already verified.', user: userOut });
    }
    if (!user.emailOtpHash || !user.emailOtpExpiresAt || user.emailOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Code expired or missing. Request a new code.' });
    }
    if (user.emailOtpHash !== hashEmailOtp(email, otpRaw)) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }
    user.isVerified = true;
    user.emailVerified = true;
    user.emailOtpHash = '';
    user.emailOtpExpiresAt = null;
    await user.save();
    const userOut = await buildUserOutForSession(user);
    setSessionCookie(res, userOut);
    (async () => {
      try {
        const appName = process.env.APP_NAME || 'SewServe';
        const webBase = process.env.WEB_BASE_URL || 'http://localhost:3000';
        const loginUrl = `${String(webBase).replace(/\/$/, '')}/login`;
        const tpl = makeWelcomeEmail({
          name: user.fullName,
          appName,
          loginUrl,
          verifyUrl: '',
        });
        const from = process.env.MAIL_FROM || process.env.SMTP_USER || '';
        await sendMailSafe({
          from,
          to: user.email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
      } catch (e) {
        console.error('[email] welcome after OTP', e);
      }
    })();
    return res.json({ ok: true, message: 'Email verified successfully.', user: userOut });
  } catch (e) {
    console.error('POST /api/auth/verify-otp', e);
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
    const order = await findOrderDocByParam(orderIdParam);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    const canonicalOrderId = String(order._id);
    // Enforce that the logged-in customer owns the order.
    if (String(order.customerId).trim() !== String(req.authUser.id)) {
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
  let op = ioInstance.to(rooms[0]);
  for (let i = 1; i < rooms.length; i++) {
    op = op.to(rooms[i]);
  }
  op.emit(event, data);
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
    if (!tid) return;
    const payload = buildWorkflowSocketPayload(orderDoc);
    console.log('[Socket Sync] measurement:updated', payload.orderId, payload.status, payload.currentStepIndex);
    io.to(tid).emit('measurement:updated', payload);
  } catch (e) {
    console.error('EMIT measurement:updated', e);
  }
}

/**
 * Tailor dashboard joins `join_user` with userId === tailor shop id (e.g. T-A1).
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
  const { customerId, tailorId, customerName, garmentType, measurements, price, status, dueDate } = b;
  if (!customerId || !tailorId) {
    return res.status(400).json({ message: 'customerId and tailorId are required.' });
  }

  try {
    // Server-side safety: customers can only create orders for themselves.
    if (req.authUser.role === 'customer' && String(customerId).trim() !== String(req.authUser.id)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
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
    if (customerId && req.authUser.role === 'customer' && customerId !== String(req.authUser.id)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (tailorId && req.authUser.role === 'tailor') {
      const shop = req.authUser.tailorShopId != null ? String(req.authUser.tailorShopId).trim() : '';
      if (!shop || tailorId !== shop) {
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
    if (String(customerId).trim() !== String(req.authUser.id)) {
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

/** Customer Track Order: order the tailor marked active (isActive), if any */
app.get('/orders/customer/:customerId/active', requireAuth, requireRole(['customer']), async (req, res) => {
  const { customerId } = req.params;
  try {
    if (String(customerId).trim() !== String(req.authUser.id)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const order = await Order.findOne({ customerId: String(customerId), isActive: true })
      .sort({ updatedAt: -1 })
      .exec();
    if (!order) {
      return res.status(404).json({ message: 'No active order.' });
    }
    return res.status(200).json(order);
  } catch (error) {
    console.error('FETCH ACTIVE CUSTOMER ORDER ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch active order.' });
  }
});

app.get('/orders/tailor/:tailorId', requireAuth, requireRole(['tailor']), async (req, res) => {
  const { tailorId } = req.params;
  try {
    const shop = req.authUser.tailorShopId != null ? String(req.authUser.tailorShopId).trim() : '';
    if (!shop || String(tailorId).trim() !== shop) {
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
    if (req.authUser.role === 'customer' && cid !== String(req.authUser.id)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (req.authUser.role === 'tailor') {
      const shop = req.authUser.tailorShopId != null ? String(req.authUser.tailorShopId).trim() : '';
      if (!shop || tid !== shop) return res.status(403).json({ message: 'Forbidden.' });
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
  if (b.tailorId != null) updatePayload.tailorId = String(b.tailorId);
  if (b.isActive === true || b.isActive === false) {
    updatePayload.isActive = Boolean(b.isActive);
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
    const existing = await findOrderDocByParam(paramId);
    if (!existing) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    // Only owning customer or assigned tailor can patch.
    const cid = existing.customerId != null ? String(existing.customerId).trim() : '';
    const tid = existing.tailorId != null ? String(existing.tailorId).trim() : '';
    if (req.authUser.role === 'customer' && cid !== String(req.authUser.id)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (req.authUser.role === 'tailor') {
      const shop = req.authUser.tailorShopId != null ? String(req.authUser.tailorShopId).trim() : '';
      if (!shop || tid !== shop) return res.status(403).json({ message: 'Forbidden.' });
    }
    const resolvedId = String(existing._id);

    if (updatePayload.isActive === true) {
      await Order.updateMany(
        { tailorId: String(existing.tailorId), _id: { $ne: existing._id } },
        { $set: { isActive: false } }
      );
    }

    const unified = computeWorkflow({ ...existing.toObject(), ...updatePayload });
    updatePayload.status = unified.status;
    updatePayload.workflowStatus = unified.workflowStatus;
    updatePayload.currentStepIndex = unified.currentStepIndex;

    const updatedOrder = await Order.findByIdAndUpdate(
      resolvedId,
      { $set: updatePayload },
      { new: true, strict: false, runValidators: false }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    emitMeasurementOrderToTailor(updatedOrder);
    try {
      const payload = buildWorkflowSocketPayload(updatedOrder);
      const patchStatusRooms = [];
      const oid = payload.orderId != null ? String(payload.orderId).trim() : '';
      if (oid) {
        patchStatusRooms.push(oid, `map_order:${oid}`);
      }
      if (patchStatusRooms.length) {
        emitToRoomUnion(io, patchStatusRooms, 'order:statusUpdated', payload);
      }

      const tId = payload.tailorId != null && String(payload.tailorId).trim() !== '' ? String(payload.tailorId).trim() : '';
      const s = payload.status != null ? String(payload.status).trim() : '';
      const isReject =
        s === 'rejected' || s === 'declined' || s === 'cancelled' || s === 'canceled';
      const isAccept = Boolean(tId) && !isReject;

      if (isAccept) {
        const oidForChat = payload.orderId != null ? String(payload.orderId).trim() : '';
        const ack = {
          orderId: payload.orderId,
          clientOrderId: payload.clientOrderId || '',
          tailorId: tId,
          status: payload.status,
          chatEnabled: isOrderDocChatEnabled(updatedOrder),
          conversationId: oidForChat ? `order_${oidForChat}` : '',
        };
        emitToRoomUnion(io, patchStatusRooms, 'orderAccepted', ack);
      } else if (isReject) {
        const rej = {
          orderId: payload.orderId,
          clientOrderId: payload.clientOrderId || '',
          tailorId: tId,
          status: payload.status,
        };
        emitToRoomUnion(io, patchStatusRooms, 'orderRejected', rej);
      }
    } catch (socketErr) {
      console.error('[Socket Sync] PATCH /orders emit error', socketErr);
    }
    console.log(
      '[Workflow Engine] PATCH /orders',
      String(updatedOrder._id),
      updatedOrder.status,
      updatedOrder.workflowStatus,
      updatedOrder.currentStepIndex
    );
    return res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('ORDER PATCH ERROR', error);
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
    // Only owning customer or assigned tailor can update.
    const cid = existingOrder.customerId != null ? String(existingOrder.customerId).trim() : '';
    const tid = existingOrder.tailorId != null ? String(existingOrder.tailorId).trim() : '';
    if (req.authUser.role === 'customer' && cid !== String(req.authUser.id)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (req.authUser.role === 'tailor') {
      const shop = req.authUser.tailorShopId != null ? String(req.authUser.tailorShopId).trim() : '';
      if (!shop || tid !== shop) return res.status(403).json({ message: 'Forbidden.' });
    }
    const unified = computeWorkflow({ ...existingOrder.toObject(), ...updatePayload });
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
  if (!raw.startsWith('order_')) return '';
  return raw.slice('order_'.length).trim();
}

function isOrderDocChatEnabled(doc) {
  if (!doc) return false;
  const tid = doc.tailorId != null ? String(doc.tailorId).trim() : '';
  if (!tid) return false;
  const v = normalizeOrderStatus(doc.status);
  if (v === 'rejected' || v === 'declined' || v === 'cancelled' || v === 'canceled') return false;
  if (v === 'order_placed') return false;
  return true;
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
    if (cid !== String(u.id)) return null;
  } else if (u.role === 'tailor') {
    const shop = u.tailorShopId != null ? String(u.tailorShopId).trim() : '';
    if (!shop || tid !== shop) return null;
  } else {
    return null;
  }
  return doc;
}

function participantIdsMatchOrder(doc, senderId, receiverId) {
  const s = String(senderId || '').trim();
  const r = String(receiverId || '').trim();
  const cid = String(doc.customerId || '').trim();
  const tid = String(doc.tailorId || '').trim();
  if (!s || !r || !cid || !tid) return false;
  return (s === cid && r === tid) || (s === tid && r === cid);
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
  });

  socket.on('join_conversation', async ({ conversationId } = {}) => {
    const raw = conversationId != null ? String(conversationId).trim() : '';
    if (!raw) return;
    const doc = await verifySocketOrderChatAccess(socket, raw);
    if (!doc) return;
    const room = raw.startsWith('conversation:') ? raw : `conversation:${raw}`;
    console.log('JOIN CONVERSATION', room);
    socket.join(room);
  });

  socket.on('join_order_room', (orderId) => {
    const room = orderId != null ? String(orderId).trim() : '';
    if (!room) return;
    socket.join(room);
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
      console.log('FETCHING CHAT HISTORY FROM DB', cid);
      const history = await Message.find({ conversationId: cid }).sort({ timestamp: 1 }).lean();
      socket.emit('chat_history', { messages: history });
    } catch (error) {
      console.error('REQUEST_HISTORY ERROR', error);
      socket.emit('chat_history', { messages: [] });
    }
  });

  socket.on('send_message', async (payload = {}) => {
    const senderId = String(payload?.senderId ?? '').trim();
    const receiverId = String(payload?.receiverId ?? '').trim();
    const conversationId = String(payload?.conversationId ?? '').trim();
    const content = String(payload?.content ?? '').trim();
    const { timestamp, status } = payload;
    if (!senderId || !receiverId || !conversationId || !content) {
      console.warn('SEND_MESSAGE rejected (missing field)', {
        hasSender: !!senderId,
        hasReceiver: !!receiverId,
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
      if (!participantIdsMatchOrder(doc, senderId, receiverId)) {
        console.warn('SEND_MESSAGE rejected (participants mismatch)');
        return;
      }
      const ts = timestamp ? new Date(timestamp) : new Date();
      if (Number.isNaN(ts.getTime())) {
        return;
      }
      const savedMessage = await Message.create({
        senderId,
        receiverId,
        conversationId,
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
      const convRoom =
        String(conversationId).trim().startsWith('conversation:')
          ? String(conversationId).trim()
          : `conversation:${String(conversationId).trim()}`;
      console.log('EMITTING TO CONVERSATION ROOM', convRoom);
      io.to(convRoom).emit('message_received', message);
      console.log('EMITTING new_notification TO CONVERSATION ROOM', convRoom);
      io.to(convRoom).emit('new_notification', {
        conversationId,
        senderId,
        content: message.content,
        timestamp: message.timestamp,
        type: 'new_message',
      });
    } catch (error) {
      console.error('SEND_MESSAGE ERROR', error);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});