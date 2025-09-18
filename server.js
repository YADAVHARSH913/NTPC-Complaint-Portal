// server.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const mongoose = require('mongoose');
<<<<<<< HEAD
const PDFDocument = require('pdfkit');
=======
>>>>>>> c7c55a2978a931ab5459e6400daa26e995a55093

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

<<<<<<< HEAD

// Export all complaints as PDF
app.get('/api/admin/complaints/export', requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status && ['Pending', 'In Progress', 'Closed', 'Rejected'].includes(status)) {
            where.status = status;
        }
        const complaints = await Complaint.find(where)
            .sort({ createdAt: -1 })
            .populate('employerId', 'name mobile');

        // bufferPages: true yahan se hata diya gaya hai
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="NTPC-Complaints-Report-${Date.now()}.pdf"`);
        doc.pipe(res);

        // -- Header function --
        const drawHeader = () => {
            const logoPath = path.join(__dirname, 'public', 'images', 'ntpc-logo.png');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 50, 40, { width: 80 });
            }
            doc.fontSize(20).font('Helvetica-Bold').fillColor('#003366').text('NTPC Complaint Report', 200, 50, { align: 'right' });
            doc.fontSize(10).font('Helvetica').fillColor('#333333').text(new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), 200, 75, { align: 'right' });
        };


        // Start by drawing the first page header
        drawHeader();

        let y = 115; // Starting Y position

        for (const complaint of complaints) {
            const estimatedHeight = 200;
            if (y + estimatedHeight > doc.page.height - 70) {
                doc.addPage();
                drawHeader();
                y = 115;
            }
            
            // -- Status Tag and Ref ID --
            const statusColors = { 'Pending': '#f6ad55', 'In Progress': '#4299e1', 'Closed': '#68d391', 'Rejected': '#f56565' };
            const refIdText = `REF: ${complaint._id.toString().slice(-6).toUpperCase()}`;
            
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333').text(refIdText, 50, y);
            
            const statusTagWidth = 100;
            const statusX = doc.page.width - 50 - statusTagWidth;
            doc.roundedRect(statusX, y - 2, statusTagWidth, 20, 10).fill(statusColors[complaint.status] || '#a0aec0');
            doc.font('Helvetica-Bold').fontSize(10).fillColor('white').text(complaint.status, statusX, y + 3, { width: statusTagWidth, align: 'center' });

            // Draw the header line AFTER all header elements are placed
            doc.moveTo(50, y + 25).lineTo(doc.page.width - 50, y + 25).strokeColor('#aaaaaa').stroke();
            
            y += 45; // Move cursor below the header line for the main content
            const contentStartY = y;

            // -- Details Section --
            const labelX = 60;
            const valueX = 150;
            const createDetailRow = (label, value) => {
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#003366').text(label, labelX, y);
                doc.font('Helvetica').fillColor('#333333').text(`: ${value || 'N/A'}`, valueX, y);
                y += 20; // Consistent vertical spacing
            };

            createDetailRow('Title', complaint.title);
            createDetailRow('Employer', complaint.employerId?.name);
            createDetailRow('Location', complaint.location);
            createDetailRow('Department', complaint.department);
            createDetailRow('Priority', complaint.priority);
            createDetailRow('Date Raised', new Date(complaint.createdAt).toLocaleDateString('en-IN'));
            
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#003366').text('Description', labelX, y);
            doc.font('Helvetica').fillColor('#333333').text(':', valueX, y);
            doc.text(complaint.description || 'N/A', valueX + 10, y, {
                width: 250,
                align: 'justify'
            });
            const textBlockHeight = y + doc.heightOfString(complaint.description || 'N/A', { width: 250 }) - contentStartY;

            // -- Complaint Image --
            let imageBlockHeight = 0;
            if (complaint.imagePath) {
                const imageFullPath = path.join(__dirname, 'public', complaint.imagePath);
                if (fs.existsSync(imageFullPath)) {
                    doc.image(imageFullPath, 400, contentStartY, { fit: [170, 170], align: 'center', valign: 'center' });
                    imageBlockHeight = 180;
                }
            }
            
            // Set Y to the bottom of the tallest block (text or image)
            y = contentStartY + Math.max(textBlockHeight, imageBlockHeight) + 20;

            // Draw a solid separator line AFTER the complaint block
            doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#003366').stroke();
            y += 20;
        }

        doc.end();

    } catch (error) {
        console.error('PDF Export Error:', error);
        res.status(500).json({ message: 'Error generating PDF report.' });
    }
});
// ------------ Page Routes (keep last) ------------
=======
// ------------ Page Routes ------------
>>>>>>> c7c55a2978a931ab5459e6400daa26e995a55093
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
<<<<<<< HEAD
app.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));
=======
app.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));
>>>>>>> c7c55a2978a931ab5459e6400daa26e995a55093
