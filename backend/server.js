const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const User = require('./models/User');
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

async function registerUser(req, res) {
  const body = req.body || {};
  const fullName = body.fullName || body.name;
  const { email, password } = body;

  if (!fullName || !email || !password) {
    return res.status(400).json({
      error: 'Full name, email, and password are required.',
      message: 'Full name, email, and password are required.',
    });
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
    });

    return res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: created.id,
        fullName: created.fullName,
        email: created.email,
      },
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

    return res.status(200).json({
      message: 'Login successful!',
      token: 'dummy-token-123',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
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

const normalizeOrderStatus = (status = '') => {
  const value = String(status).trim().toLowerCase().replace(/\s+/g, '_');
  if (value === 'in_progress' || value === 'inprogress') return 'in_progress';
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

/** Uppercase tracking enum — must match customer/tailor `orderLiveStatus.js`. */
function internalStatusToTrackingStatus(s) {
  const v = normalizeOrderStatus(s);
  if (v === 'pending' || v === 'order_placed') return 'ORDER_PLACED';
  if (v === 'measurements_verified') return 'MEASUREMENTS_VERIFIED';
  if (v === 'stitching' || v === 'in_progress' || v === 'processing' || v === 'needs_alteration') {
    return 'STITCHING';
  }
  if (v === 'quality_check') return 'QUALITY_CHECK';
  if (v === 'ready_for_delivery' || v === 'last_review') return 'READY';
  if (v === 'completed') return 'COMPLETED';
  return 'ORDER_PLACED';
}

const MAX_WORKFLOW_STEP_INDEX = 8; // 0..8 inclusive (pending → completed)

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
    measurements_verified: 1,
    processing: 2,
    in_progress: 3,
    stitching: 4,
    quality_check: 5,
    ready_for_delivery: 6,
    last_review: 7,
    completed: 8,
    needs_alteration: 4,
  };
  return map[v] ?? 0;
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

function emitMeasurementOrderToTailor(orderDoc) {
  try {
    if (!io || !orderDoc) return;
    const tid = orderDoc.tailorId != null ? String(orderDoc.tailorId).trim() : '';
    if (!tid) return;
    const order = serializeOrderForSocket(orderDoc);
    io.to(tid).emit('measurement:updated', { order });
  } catch (e) {
    console.error('EMIT measurement:updated', e);
  }
}

app.post('/orders', async (req, res) => {
  const b = req.body || {};
  const { customerId, tailorId, customerName, garmentType, measurements, price, status, dueDate } = b;
  if (!customerId || !tailorId) {
    return res.status(400).json({ message: 'customerId and tailorId are required.' });
  }

  try {
    const initialStatus = normalizeOrderStatus(
      status != null && String(status).trim() !== '' ? status : 'measurements_verified'
    );
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
      status: initialStatus,
      currentStepIndex: stepIndexFromOrderDoc({ status: initialStatus }),
      dueDate: dueDate ? new Date(dueDate) : null,
    });
    console.log('ORDER CREATED', savedOrder._id.toString());
    emitMeasurementOrderToTailor(savedOrder);
    try {
      const order = serializeOrderForSocket(savedOrder);
      io.emit('order:new', { order });
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

    if (updatePayload.status != null && updatePayload.currentStepIndex == null) {
      const merged = { ...existing.toObject(), status: updatePayload.status };
      updatePayload.currentStepIndex = stepIndexFromOrderDoc(merged);
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      resolvedId,
      { $set: updatePayload },
      { new: true, strict: false, runValidators: false }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    emitMeasurementOrderToTailor(updatedOrder);
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

    const updatedOrder = await Order.findByIdAndUpdate(
      resolvedMongoId,
      { $set: updatePayload },
      { new: true, strict: false }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    emitMeasurementOrderToTailor(updatedOrder);

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

io.on('connection', (socket) => {
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
    const out = {
      orderId: canonicalId,
      status: data.status != null ? String(data.status) : '',
    };
    const rooms = new Set([canonicalId, rawOrderId]);
    for (const r of rooms) {
      if (r) io.to(r).emit('order:statusUpdated', out);
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

    const updatedAt = Date.now();
    const clientTracking = data.status != null ? String(data.status).trim().toUpperCase() : '';

    let status = clientTracking;
    let currentStep = 0;
    let wizardData = null;

    if (doc) {
      status = internalStatusToTrackingStatus(doc.status);
      currentStep = stepIndexFromOrderDoc(doc);
      wizardData = doc.orderPayload != null ? doc.orderPayload : null;
    } else if (!status) {
      return;
    }

    const payload = {
      orderId: canonicalId,
      status,
      currentStep,
      wizardData,
      updatedAt,
    };

    const legacy = { orderId: canonicalId, status, updatedAt };
    emitOrderLiveToOrderRooms(io, canonicalId, rawOrderId, payload, legacy);
  });

  socket.on('measurement:review', (payload = {}) => {
    console.log('[SERVER] measurement:review received:', payload?.wizardData?.image);

    try {
      console.log('[SERVER] Payload size:', JSON.stringify(payload).length);
    } catch (e) {
      console.error('[SERVER] Failed to calculate payload size', e);
    }

    io.emit('measurement:reviewed', payload);
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