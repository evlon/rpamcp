import { taskQueue, type Task, type Skill } from './taskQueue.js';

export function registerSkill(
  appName: string, 
  skillName: string, 
  description?: string,
  paramsSchema?: {
    type: 'object';
    properties?: Record<string, {
      type?: string;
      description?: string;
    }>;
    required?: string[];
  }
): Skill {
  return taskQueue.registerSkill(appName, skillName, description, paramsSchema);
}

export function unregisterSkill(appName: string, skillName: string): boolean {
  return taskQueue.unregisterSkill(appName, skillName);
}

export function listSkills(appName?: string): Skill[] {
  return taskQueue.listSkills(appName);
}

export function createTask(skillName: string, appName: string, params: Record<string, any>): Task {
  return taskQueue.createTask(skillName, appName, params);
}

export function getTaskStatus(taskId: string): { id: string; status: string; skillName: string; appName: string } | null {
  return taskQueue.getTaskStatus(taskId);
}

export function getTaskResult(taskId: string): Task | null {
  return taskQueue.getTask(taskId);
}

export function listTasks(appName?: string, skillName?: string, limit: number = 10): Task[] {
  return taskQueue.listTasks(appName, skillName, limit);
}
