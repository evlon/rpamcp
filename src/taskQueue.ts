import { v4 as uuidv4 } from 'uuid';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Skill {
  name: string;
  description: string;
  appName: string;
  paramsSchema?: {
    type: 'object';
    properties?: Record<string, {
      type?: string;
      description?: string;
    }>;
    required?: string[];
  };
  createdAt: number;
}

export interface Task {
  id: string;
  skillName: string;
  appName: string;
  params: Record<string, any>;
  status: TaskStatus;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface PersistedData {
  skills: Record<string, Skill>;
  tasks: Record<string, Task>;
}

function getDataDir(): string {
  const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

function getDataFilePath(): string {
  return join(getDataDir(), 'rpamcp-data.json');
}

function loadFromDisk(): PersistedData {
  const filePath = getDataFilePath();
  if (!existsSync(filePath)) {
    return { skills: {}, tasks: {} };
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load data from disk:', error);
    return { skills: {}, tasks: {} };
  }
}

function saveToDisk(data: PersistedData): void {
  const filePath = getDataFilePath();
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save data to disk:', error);
  }
}

class TaskQueue {
  private tasks: Map<string, Task> = new Map();
  private skills: Map<string, Skill> = new Map();

  constructor() {
    const data = loadFromDisk();
    Object.values(data.skills).forEach(skill => {
      this.skills.set(`${skill.appName}:${skill.name}`, skill);
    });
    Object.values(data.tasks).forEach(task => {
      if (task.status === 'pending' || task.status === 'running') {
        task.status = 'pending';
        task.updatedAt = Date.now();
      }
      this.tasks.set(task.id, task);
    });
    console.log(`Loaded ${this.skills.size} skills and ${this.tasks.size} tasks from disk`);
  }

  registerSkill(
    appName: string, 
    skillName: string, 
    description?: string,
    paramsSchema?: Skill['paramsSchema']
  ): Skill {
    const now = Date.now();
    const skill: Skill = {
      name: skillName,
      description: description || skillName,
      appName,
      paramsSchema,
      createdAt: now,
    };
    this.skills.set(`${appName}:${skillName}`, skill);
    this.persist();
    return skill;
  }

  unregisterSkill(appName: string, skillName: string): boolean {
    const removed = this.skills.delete(`${appName}:${skillName}`);
    if (removed) {
      this.persist();
    }
    return removed;
  }

  getSkill(appName: string, skillName: string): Skill | null {
    return this.skills.get(`${appName}:${skillName}`) || null;
  }

  listSkills(appName?: string): Skill[] {
    if (!appName) {
      return Array.from(this.skills.values());
    }
    return Array.from(this.skills.values()).filter(s => s.appName === appName);
  }

  createTask(skillName: string, appName: string, params: Record<string, any>): Task {
    const now = Date.now();
    const task: Task = {
      id: uuidv4(),
      skillName,
      appName,
      params,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    this.persist();
    return task;
  }

  getNextPendingTask(appName: string, skillName?: string): Task | null {
    for (const task of this.tasks.values()) {
      if (task.status === 'pending' && task.appName === appName) {
        if (skillName && task.skillName !== skillName) {
          continue;
        }
        task.status = 'running';
        task.updatedAt = Date.now();
        return task;
      }
    }
    return null;
  }

  completeTask(taskId: string, result: any): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    
    task.status = 'completed';
    task.result = result;
    task.updatedAt = Date.now();
    this.tasks.set(taskId, task);
    this.persist();
    return task;
  }

  failTask(taskId: string, error: string): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    
    task.status = 'failed';
    task.error = error;
    task.updatedAt = Date.now();
    this.tasks.set(taskId, task);
    this.persist();
    return task;
  }

  getTask(taskId: string): Task | null {
    return this.tasks.get(taskId) || null;
  }

  getTaskStatus(taskId: string): { id: string; status: TaskStatus; skillName: string; appName: string } | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    return { 
      id: task.id, 
      status: task.status,
      skillName: task.skillName,
      appName: task.appName
    };
  }

  listTasks(appName?: string, skillName?: string, limit: number = 10): Task[] {
    let filtered = Array.from(this.tasks.values());
    
    if (appName) {
      filtered = filtered.filter(t => t.appName === appName);
    }
    
    if (skillName) {
      filtered = filtered.filter(t => t.skillName === skillName);
    }
    
    return filtered
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  private persist(): void {
    const skills: Record<string, Skill> = {};
    const tasks: Record<string, Task> = {};
    
    for (const [key, skill] of this.skills.entries()) {
      skills[key] = skill;
    }
    
    for (const [id, task] of this.tasks.entries()) {
      tasks[id] = task;
    }
    
    saveToDisk({ skills, tasks });
  }
}

export const taskQueue = new TaskQueue();
