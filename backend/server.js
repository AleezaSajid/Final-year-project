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

function corsOrigin(origin, callback) {
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
  const value = String(status).trim().toLowerCase();
  if (value === 'in progress' || value === 'in_progress') return 'in_progress';
  if (
    value === 'pending' ||
    value === 'measurements_verified' ||
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

app.post('/orders', async (req, res) => {
  const { customerId, tailorId, customerName, garmentType, measurements, price, status, dueDate } = req.body || {};
  if (!customerId || !tailorId) {
    return res.status(400).json({ message: 'customerId and tailorId are required.' });
  }

  try {
    const savedOrder = await Order.create({
      customerId: String(customerId),
      tailorId: String(tailorId),
      customerName: customerName || '',
      garmentType: garmentType || '',
      measurements: measurements && typeof measurements === 'object' ? measurements : {},
      price: Number(price || 0),
      status: normalizeOrderStatus(status),
      dueDate: dueDate ? new Date(dueDate) : null,
    });
    console.log('ORDER CREATED', savedOrder._id.toString());
    return res.status(201).json(savedOrder);
  } catch (error) {
    console.error('ORDER CREATE ERROR', error);
    return res.status(500).json({ message: 'Unable to create order right now.' });
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
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    return res.status(200).json(order);
  } catch (error) {
    console.error('FETCH ORDER BY ID ERROR', error);
    return res.status(500).json({ message: 'Unable to fetch order.' });
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

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: updatePayload },
      { new: true, strict: false }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }

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
    if (!userId) return;
    console.log('JOIN USER', userId);
    socket.join(userId);
  });

  socket.on('join_conversation', ({ conversationId } = {}) => {
    if (!conversationId) return;
    console.log('JOIN CONVERSATION', conversationId);
    socket.join(conversationId);
  });

  socket.on('request_history', async ({ conversationId } = {}) => {
    if (!conversationId) return;
    try {
      console.log('FETCHING CHAT HISTORY FROM DB', conversationId);
      const history = await Message.find({ conversationId }).sort({ timestamp: 1 }).lean();
      socket.emit('chat_history', { messages: history });
    } catch (error) {
      console.error('REQUEST_HISTORY ERROR', error);
      socket.emit('chat_history', { messages: [] });
    }
  });

  socket.on('send_message', async (payload = {}) => {
    const { senderId, receiverId, conversationId, content, timestamp, status } = payload;
    if (!senderId || !receiverId || !conversationId || !String(content || '').trim()) return;

    try {
      const savedMessage = await Message.create({
        senderId,
        receiverId,
        conversationId,
        content: String(content).trim(),
        timestamp: timestamp || new Date().toISOString(),
        status: status || 'sent',
      });

      const message = {
        id: savedMessage._id.toString(),
        senderId: savedMessage.senderId,
        receiverId: savedMessage.receiverId,
        conversationId: savedMessage.conversationId,
        content: savedMessage.content,
        timestamp: savedMessage.timestamp,
        status: savedMessage.status,
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