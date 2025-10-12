// server.js (ES Module style - node >=14 with "type":"module" or change to require)
import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import schedule from 'node-schedule';
import fs from 'fs';
import cors from 'cors';
import { VoiceMessage } from './models/VoiceMessage.js'; // create below

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// connect mongo
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true })
  .then(()=>console.log('Mongo connected'))
  .catch(e=>console.error('Mongo err', e));

// multer storage
if (!fs.existsSync(path.join(__dirname,'uploads'))) fs.mkdirSync(path.join(__dirname,'uploads'));
const storage = multer.diskStorage({
  destination: path.join(__dirname,'uploads'),
  filename: (req,file,cb) => cb(null, Date.now()+'-'+file.originalname.replace(/\s+/g,'_'))
});
const upload = multer({ storage });

// ---------------- endpoints ----------------

// list messages (sorted desc)
app.get('/api/messages', async (req,res)=>{
  const list = await VoiceMessage.find().sort({ createdAt:-1 }).lean();
  // fileUrl to absolute
  const host = `${req.protocol}://${req.get('host')}`;
  list.forEach(l=> { if (l.filePath) l.fileUrl = host + '/uploads/' + path.basename(l.filePath); else l.fileUrl=''; });
  res.json(list);
});

// realtime upload
app.post('/api/messages/realtime', upload.single('file'), async (req,res)=>{
  if (!req.file) return res.status(400).json({ error:'file required' });
  const doc = await VoiceMessage.create({
    title: req.body.title || 'Lời nhắn',
    type: 'message',
    filePath: req.file.path,
    heard: false,
    targetDevice: req.body.targetDevice || 'broadcast'
  });
  // Optionally: publish MQTT or socket.io here
  return res.json(doc);
});

// save alarm and schedule
app.post('/api/alarms', upload.single('file'), async (req,res)=>{
  if (!req.file) return res.status(400).json({ error:'file required' });
  const { title, date, time, targetDevice } = req.body;
  // expect date=YYYY-MM-DD, time=HH:MM
  const doc = await VoiceMessage.create({
    title: title || 'Báo thức',
    type: 'alarm',
    date, time,
    filePath: req.file.path,
    heard: false,
    targetDevice: targetDevice || 'broadcast'
  });

  // schedule job with node-schedule
  // parse date/time
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // Note: month index in Date is 0-based but node-schedule accepts cron or Date
  const scheduledDate = new Date(y, m-1, d, hh, mm, 0);
  schedule.scheduleJob(scheduledDate, async () => {
    // at scheduled time, mark message as pending (it already exists). For poll model,
    // ESP will poll and server will respond with this doc as pending.
    console.log('Alarm triggered:', doc._id, doc.title);
    // Optionally: send push / mqtt if available
  });

  res.json(doc);
});

// delete alarm
app.delete('/api/alarms/:id', async (req,res)=>{
  const id = req.params.id;
  const doc = await VoiceMessage.findById(id);
  if (!doc) return res.status(404).json({ error:'not found' });
  // delete file
  try { if (doc.filePath && fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath); } catch(e){}
  await VoiceMessage.findByIdAndDelete(id);
  res.json({ success:true });
});

// ---------------- Poll endpoint for ESP ----------------
// ESP calls GET /api/device/:id/poll to check whether there's a pending message
// Response when there's a pending message: { msg: { _id, type, title, fileUrl } }
// If none: { msg: null }
app.get('/api/device/:id/poll', async (req,res)=>{
  const deviceId = req.params.id;
  // Query pending messages: not heard, and (targetDevice==deviceId || broadcast)
  const doc = await VoiceMessage.findOne({ heard:false, $or:[{targetDevice:deviceId},{targetDevice:'broadcast'}] })
    .sort({ createdAt: 1 }).lean();
  if (!doc) return res.json({ msg: null });
  const host = `${req.protocol}://${req.get('host')}`;
  const fileUrl = doc.filePath ? host + '/uploads/' + path.basename(doc.filePath) : null;
  res.json({ msg: { _id: doc._id, type: doc.type, title: doc.title, fileUrl } });
});

// ---------------- ack from ESP when played ----------------
app.post('/api/device/:id/ack', async (req,res)=>{
  const deviceId = req.params.id;
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error:'messageId required' });
  const doc = await VoiceMessage.findByIdAndUpdate(messageId, { heard: true }, { new:true });
  if (!doc) return res.status(404).json({ error:'message not found' });
  // optionally log device ack
  return res.json({ success:true, doc });
});

// ---------------- start server ----------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log('Server listening on', PORT));
