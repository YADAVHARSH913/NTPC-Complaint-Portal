// server.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();

// ------------ DB Connection ------------
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ntpc_portal')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ Mongo error:', err.message);
    process.exit(1);
  });

// ------------ Schemas ------------
const employerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  photoPath: String,
  status: { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: String
}, { timestamps: true });

const complaintSchema = new mongoose.Schema({
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: String,
  department: String,
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
  status: { type: String, enum: ['Pending', 'In Progress', 'Closed', 'Rejected'], default: 'Pending' },
  imagePath: String,
  resolutionNotes: String
}, { timestamps: true });

const Employer = mongoose.model('Employer', employerSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Complaint = mongoose.model('Complaint', complaintSchema);

// ------------ Seed Default Admin ------------
(async () => {
  try {
    const USER = process.env.ADMIN_USER || 'admin';
    const PASS = process.env.ADMIN_PASS || 'admin123';
    const exists = await Admin.findOne({ username: USER });
    if (!exists) {
      const passwordHash = await bcrypt.hash(PASS, 10);
      await Admin.create({ username: USER, passwordHash });
      console.log(`🌱 Admin seeded: ${USER} / ${PASS}`);
    }
  } catch (err) {
    console.error('Error seeding admin:', err.message);
  }
})();

// ------------ Middleware ------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false
}));

// Ensure uploads dir exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'file'))
});
const upload = multer({ storage });

// ------------ Guards ------------
function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  return res.status(401).json({ success: false, error: 'Admin only' });
}
function requireEmployer(req, res, next) {
  if (req.session?.employer) return next();
  return res.status(401).json({ success: false, error: 'Employer only' });
}

// ------------ Admin Auth ------------
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const admin = await Admin.findOne({ username });
  if (!admin) return res.json({ success: false, message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return res.json({ success: false, message: 'Invalid credentials' });

  req.session.admin = { id: admin._id, username: admin.username };
  res.json({ success: true });
});
app.get('/api/admin/me', (req, res) => res.json({ admin: req.session?.admin || null }));
app.post('/api/admin/logout', (req, res) => { req.session.admin = null; res.json({ success: true }); });

// ------------ Employer Auth ------------
app.post('/api/employer/login', upload.single('photo'), async (req, res) => {
  const { name, mobile } = req.body || {};
  if (!name || !mobile || !/^\d{10}$/.test(mobile)) {
    return res.json({ success: false, message: 'Enter valid name and 10-digit mobile' });
  }

  let emp = await Employer.findOne({ mobile });
  if (!emp) {
    emp = await Employer.create({
      name,
      mobile,
      photoPath: req.file ? '/uploads/' + req.file.filename : null,
      status: 'Pending'
    });
    return res.json({ success: false, message: 'Account created. Waiting for admin approval.' });
  }

  if (req.file) {
    emp.photoPath = '/uploads/' + req.file.filename;
    await emp.save();
  }

  if (emp.status === 'Pending') return res.json({ success: false, message: 'Waiting for admin approval.' });
  if (emp.status === 'Rejected') return res.json({ success: false, message: 'Admin rejected your request.' });

  req.session.employer = { id: emp._id, name: emp.name, mobile: emp.mobile, photoPath: emp.photoPath };
  res.json({ success: true });
});
app.get('/api/employer/me', (req, res) => res.json({ employer: req.session?.employer || null }));
app.post('/api/employer/logout', (req, res) => { req.session.employer = null; res.json({ success: true }); });

// ------------ Employer Complaints ------------
app.post('/api/employer/complaints', requireEmployer, upload.single('image'), async (req, res) => {
  const { title, description, location, department, priority } = req.body || {};
  if (!title || !description) return res.status(400).json({ success: false, error: 'Title & Description required' });

  const c = await Complaint.create({
    employerId: req.session.employer.id,
    title,
    description,
    location: location || '',
    department: department || '',
    priority: ['Low', 'Medium', 'High'].includes(priority) ? priority : 'Low',
    imagePath: req.file ? '/uploads/' + req.file.filename : undefined
  });
  res.json({ success: true, complaint: c });
});
app.get('/api/employer/complaints', requireEmployer, async (req, res) => {
  const list = await Complaint.find({ employerId: req.session.employer.id }).sort({ createdAt: -1 });
  res.json({ success: true, complaints: list });
});

// ------------ Admin Employers & Complaints ------------
app.get('/api/admin/employers/pending', requireAdmin, async (req, res) => {
  const pending = await Employer.find({ status: 'Pending' }, 'name mobile photoPath createdAt');
  res.json({ success: true, pending });
});
app.get('/api/admin/employers', requireAdmin, async (req, res) => {
  const all = await Employer.find({}, 'name mobile photoPath status createdAt');
  res.json({ success: true, employers: all });
});
app.patch('/api/admin/employers/:id/accept', requireAdmin, async (req, res) => {
  const emp = await Employer.findByIdAndUpdate(req.params.id, { status: 'Accepted' }, { new: true });
  if (!emp) return res.status(404).json({ success: false, error: 'Employer not found' });
  res.json({ success: true, employer: emp });
});
app.patch('/api/admin/employers/:id/reject', requireAdmin, async (req, res) => {
  const emp = await Employer.findByIdAndUpdate(req.params.id, { status: 'Rejected' }, { new: true });
  if (!emp) return res.status(404).json({ success: false, error: 'Employer not found' });
  res.json({ success: true, employer: emp });
});
app.get('/api/admin/complaints', requireAdmin, async (req, res) => {
  const { status } = req.query;
  const where = {};
  if (status && ['Pending', 'In Progress', 'Closed', 'Rejected'].includes(status)) where.status = status;
  const list = await Complaint.find(where).sort({ createdAt: -1 }).populate('employerId', 'name mobile');
  res.json({ success: true, complaints: list });
});
app.patch('/api/admin/complaints/:id/status', requireAdmin, async (req, res) => {
  const { status, resolutionNotes } = req.body || {};
  if (!['Pending', 'In Progress', 'Closed', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }
  const c = await Complaint.findByIdAndUpdate(
    req.params.id,
    { status, resolutionNotes: (resolutionNotes || '') },
    { new: true }
  );
  if (!c) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, complaint: c });
});

// ------------ Page Routes ------------
app.get('*', (req, res) => {
  const map = {
    '/': 'index.html',
    '/admin/login': 'admin-login.html',
    '/employer/login': 'employer-login.html',
    '/admin': 'admin.html',
    '/employer': 'employer.html'
  };
  const file = map[req.path];
  if (file) return res.sendFile(path.join(__dirname, 'public', file));
  res.status(404).send('Not Found');
});

// ------------ Start Server ------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));
