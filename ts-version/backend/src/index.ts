import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.S3_BUCKET_NAME!;
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'txt', 'csv', 'docx'];
const MAX_SIZE_MB = 10;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext && ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Permitted: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  },
});

// Upload
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }
  try {
    const key = `uploads/${req.file.originalname}`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));
    res.json({ message: 'File uploaded successfully', key });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// List files
app.get('/files', async (_req, res) => {
  try {
    const response = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'uploads/' }));
    const files = (response.Contents ?? []).map(obj => ({
      key: obj.Key,
      name: obj.Key?.replace('uploads/', ''),
      size_kb: Math.round((obj.Size ?? 0) / 1024 * 100) / 100,
      uploaded_at: obj.LastModified?.toISOString().replace('T', ' ').slice(0, 19),
    }));
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Download (pre-signed URL)
app.get('/files/:filename/download', async (req, res) => {
  try {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: `uploads/${req.params.filename}` }),
      { expiresIn: 300 }
    );
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Delete
app.delete('/files/:filename', async (req, res) => {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: `uploads/${req.params.filename}` }));
    res.json({ message: `${req.params.filename} deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(5001, () => console.log('Server running on http://127.0.0.1:5001'));