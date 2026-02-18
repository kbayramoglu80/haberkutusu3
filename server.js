require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const News = require('./models/News');

const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_PATH = process.env.ADMIN_PATH || 'yonetim59x';
const ADMIN_PASS = process.env.ADMIN_PASS || 'X9k#Hb59!qTr@2026zW';

// --- Middleware ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 's3cr3t_default_key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3 * 60 * 60 * 1000 }
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/' + ADMIN_PATH + '/giris');
}

// --- Multer (image upload) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// --- MongoDB connection ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB bağlantısı başarılı'))
  .catch(err => console.error('MongoDB bağlantı hatası:', err));

// ==========================================
//  PAGE ROUTES
// ==========================================

// Ana sayfa
app.get('/', async (req, res) => {
  try {
    const empty = { heroNews: [], gundem: [], ekonomi: [], spor: [], siyaset: [], yasam: [],
      gundemCount: 0, ekonomiCount: 0, sporCount: 0, siyasetCount: 0, yasamCount: 0 };

    if (mongoose.connection.readyState !== 1) {
      return res.render('index', empty);
    }

    const heroNews = await News.find({ placement: 'hero' }).sort({ createdAt: -1 }).limit(10);
    const gundem = await News.find({ category: 'Gündem', placement: 'homepage' }).sort({ createdAt: -1 }).limit(4);
    const ekonomi = await News.find({ category: 'Ekonomi', placement: 'homepage' }).sort({ createdAt: -1 }).limit(4);
    const spor = await News.find({ category: 'Spor', placement: 'homepage' }).sort({ createdAt: -1 }).limit(4);
    const siyaset = await News.find({ category: 'Siyaset', placement: 'homepage' }).sort({ createdAt: -1 }).limit(4);
    const yasam = await News.find({ category: 'Yaşam', placement: 'homepage' }).sort({ createdAt: -1 }).limit(4);

    const gundemCount = await News.countDocuments({ category: 'Gündem' });
    const ekonomiCount = await News.countDocuments({ category: 'Ekonomi' });
    const sporCount = await News.countDocuments({ category: 'Spor' });
    const siyasetCount = await News.countDocuments({ category: 'Siyaset' });
    const yasamCount = await News.countDocuments({ category: 'Yaşam' });

    res.render('index', {
      heroNews, gundem, ekonomi, spor, siyaset, yasam,
      gundemCount, ekonomiCount, sporCount, siyasetCount, yasamCount
    });
  } catch (err) {
    console.error('Ana sayfa hatası:', err.message);
    const empty = { heroNews: [], gundem: [], ekonomi: [], spor: [], siyaset: [], yasam: [],
      gundemCount: 0, ekonomiCount: 0, sporCount: 0, siyasetCount: 0, yasamCount: 0 };
    res.render('index', empty);
  }
});

// Kategori sayfası
app.get('/kategori/:slug', async (req, res) => {
  try {
    const slugMap = {
      'gundem': 'Gündem',
      'ekonomi': 'Ekonomi',
      'spor': 'Spor',
      'siyaset': 'Siyaset',
      'yasam': 'Yaşam',
      'saglik': 'Sağlık'
    };
    const category = slugMap[req.params.slug];
    if (!category) return res.status(404).send('Kategori bulunamadı');

    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const total = await News.countDocuments({ category });
    const news = await News.find({ category }).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const totalPages = Math.ceil(total / limit);

    res.render('category', { news, category, slug: req.params.slug, page, totalPages, total });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sunucu hatası');
  }
});

// Haber detay sayfası
app.get('/haber/:id', async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) return res.status(404).send('Haber bulunamadı');

    // Aynı kategoriden diğer haberler (mevcut haber hariç)
    const related = await News.find({ category: news.category, _id: { $ne: news._id } })
      .sort({ createdAt: -1 }).limit(4);

    // Önceki ve sonraki haber
    const prev = await News.findOne({ createdAt: { $lt: news.createdAt } }).sort({ createdAt: -1 });
    const next = await News.findOne({ createdAt: { $gt: news.createdAt } }).sort({ createdAt: 1 });

    res.render('detail', { news, related, prev, next });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sunucu hatası');
  }
});

// Admin login sayfası
app.get('/' + ADMIN_PATH + '/giris', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/' + ADMIN_PATH);
  res.render('login', { error: req.query.error || '', adminPath: ADMIN_PATH });
});

app.post('/' + ADMIN_PATH + '/giris', (req, res) => {
  if (req.body.password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.redirect('/' + ADMIN_PATH);
  }
  res.redirect('/' + ADMIN_PATH + '/giris?error=1');
});

app.get('/' + ADMIN_PATH + '/cikis', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Admin paneli (korumalı)
app.get('/' + ADMIN_PATH, requireAuth, async (req, res) => {
  try {
    const category = req.query.category || '';
    const filter = category ? { category } : {};
    const news = await News.find(filter).sort({ createdAt: -1 });
    const editId = req.query.edit || null;
    let editNews = null;
    if (editId) {
      editNews = await News.findById(editId);
    }
    res.render('admin', { news, editNews, category, categories: ['Gündem', 'Ekonomi', 'Spor', 'Siyaset', 'Yaşam', 'Sağlık'], adminPath: ADMIN_PATH });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sunucu hatası');
  }
});

// ==========================================
//  API ROUTES
// ==========================================

// Create news (korumalı)
app.post('/api/news', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const data = {
      title: req.body.title,
      description: req.body.description,
      content: req.body.content || '',
      category: req.body.category,
      featured: req.body.placement === 'hero',
      placement: req.body.placement || 'none',
      image: req.file ? '/uploads/' + req.file.filename : (req.body.existingImage || '')
    };
    await News.create(data);
    res.redirect('/' + ADMIN_PATH);
  } catch (err) {
    console.error(err);
    res.redirect('/' + ADMIN_PATH + '?error=1');
  }
});

// Update news (korumalı)
app.post('/api/news/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const data = {
      title: req.body.title,
      description: req.body.description,
      content: req.body.content || '',
      category: req.body.category,
      featured: req.body.placement === 'hero',
      placement: req.body.placement || 'none'
    };
    if (req.file) {
      data.image = '/uploads/' + req.file.filename;
    }
    await News.findByIdAndUpdate(req.params.id, data);
    res.redirect('/' + ADMIN_PATH);
  } catch (err) {
    console.error(err);
    res.redirect('/' + ADMIN_PATH + '?error=1');
  }
});

// Delete news (korumalı)
app.post('/api/news/:id/delete', requireAuth, async (req, res) => {
  try {
    await News.findByIdAndDelete(req.params.id);
    res.redirect('/' + ADMIN_PATH);
  } catch (err) {
    console.error(err);
    res.redirect('/' + ADMIN_PATH + '?error=1');
  }
});

// JSON API - all news
app.get('/api/news', async (req, res) => {
  try {
    const category = req.query.category || '';
    const filter = category ? { category } : {};
    const news = await News.find(filter).sort({ createdAt: -1 });
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
  console.log(`Admin paneli: http://localhost:${PORT}/${ADMIN_PATH}`);
});
