#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { startHttpServer } from './server.js';
import { 
  createTask, 
  getTaskStatus, 
  getTaskResult, 
  listTasks,
  registerSkill,
  unregisterSkill,
  listSkills
} from './tools.js';

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3001', 10);

const server = new Server(
  {
    name: 'rpamcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const skills = listSkills();
  const dynamicToolSchemas = skills
    .filter(s => s.paramsSchema)
    .map(skill => ({
      name: `create_task_${skill.appName}_${skill.name}`,
      description: `Create a ${skill.name} task for ${skill.appName}. ${skill.description}`,
      inputSchema: {
        type: 'object',
        properties: {
          params: skill.paramsSchema!,
        },
        required: skill.paramsSchema!.required || [],
      },
    }));

  return {
    tools: [
      {
        name: 'register_skill',
        description: 'Register a new skill for an RPA application',
        inputSchema: {
          type: 'object',
          properties: {
            appName: {
              type: 'string',
              description: 'Application name (e.g., "data_processor")',
            },
            skillName: {
              type: 'string',
              description: 'Skill name (e.g., "web_scrape")',
            },
            description: {
              type: 'string',
              description: 'Skill description',
            },
            paramsSchema: {
              type: 'object',
              description: 'JSON Schema defining required parameters for this skill',
              properties: {
                type: { type: 'string', default: 'object' },
                properties: {
                  type: 'object',
                  description: 'Parameter definitions',
                },
                required: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Required parameter names',
                },
              },
            },
          },
          required: ['appName', 'skillName'],
        },
      },
      {
        name: 'unregister_skill',
        description: 'Unregister a skill from an RPA application',
        inputSchema: {
          type: 'object',
          properties: {
            appName: {
              type: 'string',
              description: 'Application name',
            },
            skillName: {
              type: 'string',
              description: 'Skill name',
            },
          },
          required: ['appName', 'skillName'],
        },
      },
      {
        name: 'list_skills',
        description: 'List all registered skills, optionally filtered by app',
        inputSchema: {
          type: 'object',
          properties: {
            appName: {
              type: 'string',
              description: 'Filter by application name',
            },
          },
        },
      },
      {
        name: 'create_task',
        description: 'Create a new task for a specific skill and app (generic version)',
        inputSchema: {
          type: 'object',
          properties: {
            skillName: {
              type: 'string',
              description: 'Target skill name',
            },
            appName: {
              type: 'string',
              description: 'Target application name',
            },
            params: {
              type: 'object',
              description: 'Task parameters (use specific create_task_<app>_<skill> for schema validation)',
            },
          },
          required: ['skillName', 'appName', 'params'],
        },
      },
      ...dynamicToolSchemas,
      {
        name: 'get_task_status',
        description: 'Get the status of a task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'get_task_result',
        description: 'Get the full result of a completed task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'list_tasks',
        description: 'List recent tasks, optionally filtered by app or skill',
        inputSchema: {
          type: 'object',
          properties: {
            appName: {
              type: 'string',
              description: 'Filter by application name',
            },
            skillName: {
              type: 'string',
              description: 'Filter by skill name',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of tasks to return',
              default: 10,
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'register_skill': {
        const { appName, skillName, description, paramsSchema } = args as { 
          appName: string; 
          skillName: string; 
          description?: string;
          paramsSchema?: {
            type: 'object';
            properties?: Record<string, {
              type?: string;
              description?: string;
            }>;
            required?: string[];
          };
        };
        const skill = registerSkill(appName, skillName, description, paramsSchema);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                skill: {
                  name: skill.name,
                  appName: skill.appName,
                  description: skill.description,
                  hasParamsSchema: !!skill.paramsSchema,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'unregister_skill': {
        const { appName, skillName } = args as { appName: string; skillName: string };
        const removed = unregisterSkill(appName, skillName);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: removed }, null, 2),
            },
          ],
        };
      }

      case 'list_skills': {
        const { appName } = args as { appName?: string };
        const skills = listSkills(appName);
        return {
          content: [{ type: 'text', text: JSON.stringify(skills, null, 2) }],
        };
      }

      case 'create_task': {
        const { skillName, appName, params } = args as { 
          skillName: string; 
          appName: string; 
          params: Record<string, any>;
        };
        const task = createTask(skillName, appName, params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                taskId: task.id,
                skillName: task.skillName,
                appName: task.appName,
                status: task.status,
                createdAt: task.createdAt,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_task_status': {
        const { taskId } = args as { taskId: string };
        const status = getTaskStatus(taskId);
        if (!status) {
          return {
            content: [{ type: 'text', text: 'Task not found' }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
        };
      }

      case 'get_task_result': {
        const { taskId } = args as { taskId: string };
        const task = getTaskResult(taskId);
        if (!task) {
          return {
            content: [{ type: 'text', text: 'Task not found' }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
        };
      }

      case 'list_tasks': {
        const { appName, skillName, limit = 10 } = args as { 
          appName?: string; 
          skillName?: string; 
          limit?: number;
        };
        const tasks = listTasks(appName, skillName, limit);
        return {
          content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

async function main() {
  await startHttpServer(HTTP_PORT);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
