const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const session = require('express-session');
const db = require('./src/config/db');
const { initDB } = require('./src/services/dbInitService');

// Route Modules
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const docRoutes = require('./src/routes/docRoutes');
const signatureRoutes = require('./src/routes/signatureRoutes');
const accessRoutes = require('./src/routes/accessRoutes');
const certRoutes = require('./src/routes/certRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const systemRoutes = require('./src/routes/systemRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'docms-secret-key-2569',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Static files
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', docRoutes);
app.use('/api/certificates', certRoutes);
app.use('/', signatureRoutes);
app.use('/', accessRoutes);
app.use('/', profileRoutes);
app.use('/', systemRoutes);

// Serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'));
});

// Initialize database & Start Server
async function startServer() {
  try {
    await initDB();
  } catch (err) {
    console.error('\n⚠️  [Database Warning] Could not connect to MySQL server at ' + (process.env.DB_HOST || 'localhost') + ':' + (process.env.DB_PORT || '3306'));
    console.error('👉 กรุณาตรวจสอบว่า Service MySQL (เช่น MySQL80 หรือ XAMPP) กำลังทำงาน และรหัสผ่านในไฟล์ .env ถูกต้อง\n');
  }

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  ระบบจัดการเอกสารดิจิทัล (Digital Document Management)  ║
║  Backend: Modular Node.js / Express + MySQL Database     ║
║  Server running at http://localhost:${PORT}               ║
╚══════════════════════════════════════════════════════════╝
    `);
  });
}

startServer();
