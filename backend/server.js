const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const User = require('./models/User');
const TailorProfile = require('./models/TailorProfile');
const Message = require('./models/Message');
const Order = require('./models/Order');

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

mongoose
  .connect('mongodb://127.0.0.1:27017/sewserve')
  .then(() => {
    console.log('DB CONNECTED');
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

const DEFAULT_TAILOR_IMAGE =
  'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=450&fit=crop&q=80';

function mapTailorProfileToPublicRow(doc, idx = 0) {
  const d = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
  if (!d) return null;
  const priceStart = Math.max(0, Number(d.priceStart) || 0);
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
    imageUrl: (d.imageUrl && String(d.imageUrl).trim()) || DEFAULT_TAILOR_IMAGE,
    bio: d.bio || '',
    skillsNotes: d.skillsNotes || '',
  };
}

async function registerUser(req, res) {
  const body = req.body || {};
  const fullName = body.fullName || body.name;
  const { email, password } = body;
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
    const created = await User.create({
      id: nextUserId,
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      password,
      role,
      phone: String(body.phone || '').trim(),
      address: String(body.address || '').trim(),
      experience: String(body.experience || '').trim(),
    });

    let tailorShopId = null;
    if (role === 'tailor') {
      tailorShopId = `T-U${created.id}`;
      const shopName = String(body.shopName || '').trim();
      const city = String(body.city || '').trim();
      const specialty = String(body.specialty || '').trim();
      const experienceYears = Math.max(0, parseInt(String(body.experienceYears || '0'), 10) || 0);
      const priceStart = Math.max(0, parseInt(String(body.priceStart || '1500'), 10) || 1500);
      const deliveryDays = Math.max(1, parseInt(String(body.deliveryDays || '7'), 10) || 7);
      try {
        await TailorProfile.create({
          userId: created.id,
          email: normalizedEmail,
          tailorShopId,
          shopName,
          displayName: String(fullName).trim(),
          city,
          address: String(body.address || '').trim(),
          specialty,
          bio: String(body.bio || '').trim(),
          skillsNotes: String(body.experience || '').trim(),
          experienceYears,
          priceStart,
          deliveryDays,
          imageUrl: String(body.imageUrl || '').trim() || DEFAULT_TAILOR_IMAGE,
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

    return res.status(201).json({
      message: 'Account created successfully.',
      user: userOut,
    });
  } catch (error) {
    console.error('SIGNUP ERROR', error);
    return res.status(500).json({ error: 'Unable to create account right now.', message: 'Unable to create account right now.' });
  }
}

app.post('/signup', registerUser);
app.post('/api/register', registerUser);

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

    let tailorShopId = null;
    if (user.role === 'tailor') {
      const tp = await TailorProfile.findOne({ userId: user.id }).select('tailorShopId').lean();
      if (tp && tp.tailorShopId) tailorShopId = String(tp.tailorShopId).trim();
    }

    return res.status(200).json({
      message: 'Login successful!',
      token: 'dummy-token-123',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role || 'customer',
        ...(tailorShopId ? { tailorShopId } : {}),
      },
    });
  } catch (error) {
    console.error('LOGIN ERROR', error);
    return res.status(500).json({ error: 'Unable to login right now.', message: 'Unable to login right now.' });
  }
}

app.post('/login', loginUser);
app.post('/api/login', loginUser);

app.get('/api/me', (req, res) => {
  res.json({ user: null });
});

app.post('/api/logout', (req, res) => {
  res.json({ ok: true });
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

function stepIndexFromOrderDoc(doc) {
  if (!doc) return 0;
  const raw = doc.currentStepIndex;
  if (raw != null && Number.isFinite(Number(raw))) {
    return Math.max(0, Math.min(MAX_WORKFLOW_STEP_INDEX, Number(raw)));
  }
  const v = normalizeOrderStatus(doc.status);
  const map = {
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
  return Math.max(0, Math.min(MAX_WORKFLOW_STEP_INDEX, map[v] ?? 0));
}

function normalizeOrderWorkflowFields(raw = {}) {
  const status = normalizeOrderStatus(raw.status != null ? raw.status : raw.workflowStatus);
  const currentStepIndex = stepIndexFromOrderDoc({
    ...raw,
    status,
    currentStepIndex: raw.currentStepIndex ?? raw.currentStep,
  });
  const workflowStatus = status;
  return { status, workflowStatus, currentStepIndex, updatedAt: new Date().toISOString() };
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
  for (const r of rooms) {
    if (!r) continue;
    ioInstance.to(r).emit('order:liveUpdate', payload);
    if (legacyStatusPayload) {
      ioInstance.to(r).emit('order:statusUpdated', legacyStatusPayload);
    }
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
  const normalized = normalizeOrderWorkflowFields(fullOrder || { id: fallbackOrderId });
  const orderId = String(fullOrder?.id || fullOrder?._id || fallbackOrderId || '').trim();
  return {
    orderId,
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
  let targeted = false;
  if (tid) {
    console.log('[Socket Sync] measurement:reviewed → tailor room', tid, oid || out.orderId);
    io.to(tid).emit('measurement:reviewed', out);
    targeted = true;
  }
  if (oid) {
    console.log('[Socket Sync] measurement:reviewed → order room', oid);
    io.to(oid).emit('measurement:reviewed', out);
    targeted = true;
  }
  if (!targeted) {
    console.warn('[Socket Sync] measurement:reviewed fallback broadcast (no tailorId/orderId)', out.orderId);
    io.emit('measurement:reviewed', out);
  }
}

app.post('/orders', async (req, res) => {
  const b = req.body || {};
  const { customerId, tailorId, customerName, garmentType, measurements, price, status, dueDate } = b;
  if (!customerId || !tailorId) {
    return res.status(400).json({ message: 'customerId and tailorId are required.' });
  }

  try {
    const workflow = normalizeOrderWorkflowFields({
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
app.get('/orders', async (req, res) => {
  try {
    const q = {};
    const customerId = req.query.customerId != null ? String(req.query.customerId).trim() : '';
    const tailorId = req.query.tailorId != null ? String(req.query.tailorId).trim() : '';
    if (customerId) q.customerId = customerId;
    if (tailorId) q.tailorId = tailorId;
    const orders = await Order.find(q).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    console.error('FETCH ORDERS (QUERY) ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch orders.' });
  }
});

app.get('/orders/customer/:customerId', async (req, res) => {
  const { customerId } = req.params;
  try {
    console.log('FETCH CUSTOMER ORDERS', customerId);
    const orders = await Order.find({ customerId: String(customerId) }).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    console.error('FETCH CUSTOMER ORDERS ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch customer orders.' });
  }
});

/** Customer Track Order: order the tailor marked active (isActive), if any */
app.get('/orders/customer/:customerId/active', async (req, res) => {
  const { customerId } = req.params;
  try {
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

app.get('/orders/tailor/:tailorId', async (req, res) => {
  const { tailorId } = req.params;
  try {
    console.log('FETCH TAILOR ORDERS', tailorId);
    const orders = await Order.find({ tailorId: String(tailorId) }).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    console.error('FETCH TAILOR ORDERS ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch tailor orders.' });
  }
});

app.get('/orders/:orderId', async (req, res) => {
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
    return res.status(200).json(order);
  } catch (error) {
    console.error('FETCH ORDER BY ID ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch order.' });
  }
});

/** Partial wizard / measurement updates — does not replace PUT workflow fields contract */
app.patch('/orders/:orderId', async (req, res) => {
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
    const resolvedId = String(existing._id);

    if (updatePayload.isActive === true) {
      await Order.updateMany(
        { tailorId: String(existing.tailorId), _id: { $ne: existing._id } },
        { $set: { isActive: false } }
      );
    }

    const unified = normalizeOrderWorkflowFields({ ...existing.toObject(), ...updatePayload });
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

app.put('/orders/:orderId', async (req, res) => {
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
    const unified = normalizeOrderWorkflowFields({ ...existingOrder.toObject(), ...updatePayload });
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

io.on('connection', (socket) => {
  socket.on('newOrder', (order) => {
    console.log('[socket] newOrder received from client:', order);
    io.emit('newOrder', order);
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
    const queue = ['T-A1', 't2', 't3'];
    queue.forEach((tailorId, i) => {
      setTimeout(() => {
        socket.emit('tailorInterested', {
          orderId,
          tailorId,
          tailor: { id: tailorId },
        });
      }, 500 + i * MAP_INTEREST_STAGGER_MS);
    });
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

  socket.on('join_conversation', ({ conversationId } = {}) => {
    const room = conversationId != null ? String(conversationId).trim() : '';
    if (!room) return;
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
    const rawOrderId = data.orderId != null ? String(data.orderId).trim() : '';
    if (!rawOrderId) return;
    socket.join(rawOrderId);
    let canonicalId = rawOrderId;
    try {
      const doc = await findOrderDocByParam(rawOrderId);
      if (doc) canonicalId = String(doc._id);
    } catch (err) {
      console.error('[RELAY] order:statusUpdated', err);
    }
    if (canonicalId !== rawOrderId) {
      socket.join(canonicalId);
    }
    let updatedDoc = await findOrderDocByParam(canonicalId);
    if (updatedDoc && data.status != null && String(data.status).trim() !== '') {
      const unified = normalizeOrderWorkflowFields({ ...updatedDoc.toObject(), status: String(data.status) });
      updatedDoc = await Order.findByIdAndUpdate(
        String(updatedDoc._id),
        { $set: unified },
        { new: true, strict: false }
      );
    }
    const payload = buildWorkflowSocketPayload(updatedDoc, canonicalId);
    console.log('[Socket Sync] order:statusUpdated', payload.orderId, payload.status, payload.currentStepIndex);
    const rooms = new Set([canonicalId, rawOrderId]);
    for (const r of rooms) {
      if (r) io.to(r).emit('order:statusUpdated', payload);
    }
  });

  socket.on('order:active', (data = {}) => {
    const orderId = data.orderId != null ? String(data.orderId).trim() : '';
    if (!orderId) return;
    socket.join(orderId);
    io.to(orderId).emit('order:sync', { orderId });
  });

  socket.on('order:statusUpdate', async (data = {}) => {
    console.log('[SERVER] status update:', data);
    const rawOrderId = data.orderId != null ? String(data.orderId).trim() : '';
    if (!rawOrderId) return;

    socket.join(rawOrderId);

    let doc = null;
    try {
      doc = await findOrderDocByParam(rawOrderId);
    } catch (e) {
      console.error('[SERVER] order:statusUpdate load', e);
    }

    const canonicalId = doc ? String(doc._id) : rawOrderId;
    if (canonicalId !== rawOrderId) {
      socket.join(canonicalId);
    }

    let updatedDoc = doc;
    if (updatedDoc && data.status != null && String(data.status).trim() !== '') {
      const unified = normalizeOrderWorkflowFields({ ...updatedDoc.toObject(), status: String(data.status) });
      updatedDoc = await Order.findByIdAndUpdate(
        String(updatedDoc._id),
        { $set: unified },
        { new: true, strict: false }
      );
    }
    const payload = buildWorkflowSocketPayload(updatedDoc, canonicalId);
    console.log('[Socket Sync] order:liveUpdate', payload.orderId, payload.status, payload.currentStepIndex);
    emitOrderLiveToOrderRooms(io, canonicalId, rawOrderId, payload, payload);
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
      console.log('EMITTING TO CONVERSATION ROOM', conversationId);
      io.to(conversationId).emit('message_received', message);
      console.log('EMITTING TO USER ROOM', receiverId);
      io.to(receiverId).emit('message_received', message);
      io.to(receiverId).emit('new_notification', {
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