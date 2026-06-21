require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const participantRoutes = require('./routes/participants');
const teamRoutes = require('./routes/teams');
const previousParticipantRoutes = require('./routes/previousParticipants');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payments');
const contactRoutes = require('./routes/contact');

const app = express();

// ─── Security Middleware ───────────────────────────────────────────
app.use(compression());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// ─── Rate Limiting ─────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});
// BUG 6 FIX: Dedicated stricter limiter for registration endpoint
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 registration attempts per 15 minutes per IP
  message: { success: false, message: 'Too many registration attempts. Please try again later.' },
});
app.use(['/api/', '/'], limiter);
app.use(['/api/auth', '/auth'], authLimiter);
app.use(['/api/participants/register', '/participants/register'], registrationLimiter);


// (No special raw body parsing needed for Razorpay verify)

// ─── Body Parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// ─── Static Files (Uploads) ────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ────────────────────────────────────────────────────────
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/participants', '/participants'], participantRoutes);
app.use(['/api/teams', '/teams'], teamRoutes);
app.use(['/api/previous-participants', '/previous-participants'], previousParticipantRoutes);
app.use(['/api/notifications', '/notifications'], notificationRoutes);
app.use(['/api/dashboard', '/dashboard'], dashboardRoutes);
app.use(['/api/payments', '/payments'], paymentRoutes);
app.use(['/api/contact', '/contact'], contactRoutes);

// ─── Health Check ──────────────────────────────────────────────────
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ success: true, message: 'ByteBrainiacs API is running 🚀', timestamp: new Date() });
});

// ─── Global Error Handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Max 5MB allowed.' });
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ─── MongoDB + Server Start ────────────────────────────────────────
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }
  try {
    const db = await mongoose.connect(process.env.MONGO_URI);
    isConnected = db.connections[0].readyState;
    console.log('✅ MongoDB connected successfully.');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
  }
};

connectDB();

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 ByteBrainiacs server running on http://localhost:${PORT}`);
  });
}
// Force nodemon reload - env updated

module.exports = app;


