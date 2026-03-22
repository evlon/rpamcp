import express from 'express';
import cors from 'cors';
import { taskQueue } from './taskQueue.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/task/next', (req, res) => {
  const { appName, skillName } = req.query;
  
  if (!appName) {
    return res.status(400).json({ error: 'appName is required' });
  }
  
  const task = taskQueue.getNextPendingTask(appName as string, skillName as string | undefined);
  if (!task) {
    return res.json({ task: null });
  }
  res.json({ task });
});

app.post('/api/task/:id/complete', (req, res) => {
  const { id } = req.params;
  const { result, error } = req.body;

  if (error) {
    const task = taskQueue.failTask(id, error);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.json({ success: true, task });
  }

  const task = taskQueue.completeTask(id, result);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json({ success: true, task });
});

app.get('/api/task/:id', (req, res) => {
  const { id } = req.params;
  const task = taskQueue.getTask(id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json({ task });
});

app.post('/api/skill/register', (req, res) => {
  const { appName, skillName, description, paramsSchema } = req.body;
  
  if (!appName || !skillName) {
    return res.status(400).json({ error: 'appName and skillName are required' });
  }
  
  const skill = taskQueue.registerSkill(appName, skillName, description, paramsSchema);
  res.json({ success: true, skill });
});

app.delete('/api/skill/register', (req, res) => {
  const { appName, skillName } = req.query;
  
  if (!appName || !skillName) {
    return res.status(400).json({ error: 'appName and skillName are required' });
  }
  
  const removed = taskQueue.unregisterSkill(appName as string, skillName as string);
  res.json({ success: removed });
});

app.get('/api/skills', (req, res) => {
  const { appName } = req.query;
  const skills = taskQueue.listSkills(appName as string | undefined);
  res.json({ skills });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/task/create', (req, res) => {
  const { appName, skillName, params } = req.body;
  
  if (!appName || !skillName) {
    return res.status(400).json({ error: 'appName and skillName are required' });
  }
  
  const task = taskQueue.createTask(skillName, appName, params || {});
  res.json({ success: true, task });
});

export function startHttpServer(port: number = 3001) {
  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`HTTP API server running on port ${port}`);
      console.log(`RPA poll endpoint: http://localhost:${port}/api/task/next?appName=xxx`);
      console.log(`RPA complete endpoint: http://localhost:${port}/api/task/:id/complete`);
      console.log(`Skill register endpoint: http://localhost:${port}/api/skill/register`);
      resolve();
    });
  });
}
