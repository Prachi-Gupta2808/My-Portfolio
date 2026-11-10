import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projects } from '../shared/projects.js';

const app = express();
const port = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

const projectSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  order: Number,
  name: String,
  year: String,
  type: String,
  stack: [String],
  cover: String,
  summary: String,
  overview: String,
  highlights: [String],
  url: String,
  liveUrl: String,
  github: String,
}, { timestamps: true });

const PortfolioProject = mongoose.models.PortfolioProject || mongoose.model('PortfolioProject', projectSchema);

const orderProjects = (stored = []) => {
  const storedById = new Map(stored.map((project) => [project.id, project]));
  return projects.map((project) => ({ ...project, ...storedById.get(project.id) }));
};

app.get('/api/projects', async (_req, res) => {
  try {
    const stored = mongoose.connection.readyState === 1
      ? await PortfolioProject.find({ id: { $in: projects.map((project) => project.id) } }).lean()
      : [];
    res.json(orderProjects(stored));
  } catch {
    res.status(500).json({ message: 'Unable to load projects' });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const fallback = projects.find((project) => project.id === req.params.id);
    const stored = mongoose.connection.readyState === 1
      ? await PortfolioProject.findOne({ id: req.params.id }).lean()
      : null;
    const project = fallback ? { ...fallback, ...stored } : null;
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch {
    res.status(500).json({ message: 'Unable to load project' });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));
}

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
      await PortfolioProject.bulkWrite(projects.map((project) => ({
        updateOne: { filter: { id: project.id }, update: { $set: project }, upsert: true },
      })));
      console.log('MongoDB connected');
    })
    .catch((error) => console.error('MongoDB connection failed:', error.message));
}

const server = app.listen(port, () => console.log(`Portfolio API listening on ${port}`));
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Portfolio API is already running on ${port}; using the existing server.`);
    return;
  }
  console.error('Portfolio API failed to start:', error);
  process.exitCode = 1;
});
