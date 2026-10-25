const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const passport = require('passport');
const aiRoutes = require("./routes/aiRoutes");

dotenv.config();
require('./config/passport');

console.log('>>> SERVER FILE RUNNING FROM:', __filename);

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(passport.initialize());

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/brands', require('./routes/brands'));
app.use('/api/brand-categories', require('./routes/brandCategories'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/pipes', require('./routes/pipes'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/members', require('./routes/members'));
app.use('/api/basket', require('./routes/basket'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/invoice', require('./routes/invoice'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/ai', require('./routes/ai'));
app.use("/api/ai-search", aiRoutes);
app.use('/api/mini', require('./routes/mini'));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-admin', () => {
    socket.join('admin-room');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/basava-mart')
  .then(() => {
    console.log('MongoDB connected');
    const Brand = require('./models/Brand');
    const { Category, Subcategory } = require('./models/Category');
    Promise.all([
      Brand.updateMany({ accessLevel: { $exists: false } }, { $set: { accessLevel: 'both' } }),
      Category.updateMany({ accessLevel: { $exists: false } }, { $set: { accessLevel: 'both' } }),
      Subcategory.updateMany({ accessLevel: { $exists: false } }, { $set: { accessLevel: 'both' } }),
    ]).catch(err => console.error('Access level backfill error:', err.message));
    server.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = { io };
