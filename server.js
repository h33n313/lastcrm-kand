
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_db';

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + (file.mimetype.split('/')[1] || 'webm'));
  }
});
const upload = multer({ storage: storage });

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Error:', err));

const QuestionSchema = new mongoose.Schema({ id: String, text: String, type: String, order: Number, visibility: String, category: { type: String, default: 'all' } });
const UserSchema = new mongoose.Schema({ id: String, username: String, name: String, role: String, title: String, order: Number, isPasswordEnabled: Boolean, password: { type: String, default: '' }, avatarColor: String });
const SettingsSchema = new mongoose.Schema({
    brandName: String,
    developerPassword: String,
    iotypeApiKey: String,
    geminiApiKeys: [String],
    transcriptionMode: { type: String, default: 'iotype' },
    users: [UserSchema],
    questions: [QuestionSchema],
    enabledIcons: [String]
}, { timestamps: true });
const SettingsModel = mongoose.model('Setting', SettingsSchema);

const FeedbackSchema = new mongoose.Schema({
    id: String, trackingId: Number, source: String, surveyType: String, registrarName: String, registrarUsername: String, status: String, ward: String,
    patientInfo: { name: String, nationalId: String, gender: String, birthDate: String, mobile: String, address: String, admissionDate: String },
    insuranceInfo: { type: { type: String }, name: String },
    clinicalInfo: { reason: String, doctor: String, hasSurgery: Boolean, surgeon: String, surgeryType: String },
    dischargeInfo: { isDischarged: Boolean, date: String, type: { type: String }, doctor: String },
    answers: { type: Map, of: mongoose.Schema.Types.Mixed },
    audioFiles: { type: Map, of: mongoose.Schema.Types.Mixed },
    createdAt: Date, lastModified: Date
});
const FeedbackModel = mongoose.model('Feedback', FeedbackSchema);

app.get('/api/settings', async (req, res) => {
    try {
        let s = await SettingsModel.findOne();
        if (!s) s = await SettingsModel.create({ brandName: "سامانه جهان امید سلامت", users: [], questions: [], geminiApiKeys: [] });
        res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', async (req, res) => {
    try {
        const updated = await SettingsModel.findOneAndUpdate({}, req.body, { new: true, upsert: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/password', async (req, res) => {
    try {
        const { targetUserId, newPassword, currentUsername } = req.body;
        const settings = await SettingsModel.findOne();
        const currentUser = settings.users.find(u => u.username === currentUsername);
        const targetUser = settings.users.find(u => u.id === targetUserId);

        if (!currentUser || !targetUser) return res.status(404).json({error: 'User not found'});

        const isSelf = currentUser.id === targetUser.id;
        // Mahlouji can ONLY edit himself
        if (currentUsername === 'mahlouji' && !isSelf) return res.status(403).json({ error: 'Permission denied' });

        const isManager = ['matlabi', 'kand'].includes(currentUser.username);
        const isSupervisor = ['mostafavi'].includes(currentUser.username);
        const isTargetStaff = !['matlabi', 'kand', 'mahlouji', 'mostafavi'].includes(targetUser.username);

        const canEdit = isSelf || ((isManager || isSupervisor) && isTargetStaff);
        if (!canEdit) return res.status(403).json({ error: 'Permission denied' });

        const updatedUsers = settings.users.map(u => {
            if (u.id === targetUserId) return { ...u, password: newPassword, isPasswordEnabled: true };
            return u;
        });

        await SettingsModel.findOneAndUpdate({}, { users: updatedUsers });
        res.json({ message: 'Success' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/stt', upload.single('audioFile'), async (req, res) => {
    const filePath = req.file?.path;
    try {
        const { provider, apiKeys } = req.body;
        if (provider === 'gemini') {
            const { GoogleGenAI } = await import("@google/genai");
            let keys = [];
            try { keys = JSON.parse(apiKeys); } catch(e) { keys = [apiKeys]; }
            
            const fileBuffer = fs.readFileSync(filePath);
            const base64Audio = fileBuffer.toString('base64');
            
            let lastErr = null;
            for (const key of keys) {
                if (!key) continue;
                try {
                    const ai = new GoogleGenAI({ apiKey: key });
                    const response = await ai.models.generateContent({
                        model: 'gemini-3-flash-preview',
                        contents: [{ parts: [
                            { inlineData: { mimeType: req.file.mimetype, data: base64Audio } },
                            { text: "فقط متن فارسی این فایل صوتی را بنویس. بدون هیچ توضیح اضافه." }
                        ]}]
                    });
                    if (response.text) {
                        if (filePath) fs.unlinkSync(filePath);
                        return res.json({ text: response.text.trim() });
                    }
                } catch (err) { lastErr = err; }
            }
            throw new Error(lastErr?.message || "Gemini Failed");
        }
    } catch (e) {
        if (filePath) fs.unlinkSync(filePath);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/test-gemini', async (req, res) => {
    try {
        const settings = await SettingsModel.findOne();
        const keys = settings.geminiApiKeys || [];
        if (keys.length === 0) return res.status(400).json({ error: 'No keys found' });
        const { GoogleGenAI } = await import("@google/genai");
        for (const key of keys) {
            if (!key) continue;
            try {
                const ai = new GoogleGenAI({ apiKey: key });
                const resGem = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'سلام' });
                if (resGem.text) return res.json({ message: 'OK', details: resGem.text });
            } catch (err) { console.error("Test key fail:", key.substring(0,5)); }
        }
        res.status(500).json({ error: 'All keys failed' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/feedback', async (req, res) => {
    try { res.json(await FeedbackModel.find().sort({ createdAt: -1 })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/feedback', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        // Mahlouji Restriction Check (Server Side)
        if (data.registrarUsername === 'mahlouji' && id) {
             const existing = await FeedbackModel.findOne({id});
             if (existing) return res.status(403).json({error: 'Access denied'});
        }
        if (id) {
            const updated = await FeedbackModel.findOneAndUpdate({ id }, { ...data, lastModified: new Date() }, { new: true });
            return res.json(updated);
        }
        const last = await FeedbackModel.findOne().sort({ trackingId: -1 });
        const nextId = last ? last.trackingId + 1 : 1000;
        const fresh = await FeedbackModel.create({ ...data, id: Date.now().toString(), trackingId: nextId, createdAt: new Date() });
        res.status(201).json(fresh);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/feedback/:id', async (req, res) => {
    try { await FeedbackModel.findOneAndDelete({ id: req.params.id }); res.json({ message: 'OK' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/full-backup', async (req, res) => {
    try {
        const s = await SettingsModel.findOne();
        const f = await FeedbackModel.find();
        res.setHeader('Content-Disposition', `attachment; filename="backup.json"`);
        res.json({ timestamp: new Date(), settings: s, feedback: f });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/full-restore', async (req, res) => {
    try {
        const { settings, feedback } = req.body;
        await SettingsModel.deleteMany({});
        await FeedbackModel.deleteMany({});
        if (settings) await SettingsModel.create(settings);
        if (feedback) await FeedbackModel.insertMany(feedback);
        res.json({ message: "OK" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'error' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Port ${PORT}`));
