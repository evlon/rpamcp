#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { startHttpServer } from './server.js';
import { createTask, getTaskStatus, getTaskResult, listTasks, registerSkill, unregisterSkill, listSkills } from './tools.js';
import express from 'express';
import cors from 'cors';

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3001', 10);
const MCP_PORT = parseInt(process.env.MCP_PORT || '3002', 10);
const MODE = process.env.MODE || 'stdio';

function setupToolHandlers(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const skills = listSkills();
    const dynamicToolSchemas = skills
      .filter(s => s.paramsSchema)
      .map(skill => ({
        name: `create_task_${skill.appName}_${skill.name}`,
        description: `Create a ${skill.name} task for ${skill.appName}. ${skill.description}`,
        inputSchema: {
          type: 'object',
          properties: { params: skill.paramsSchema! },
          required: skill.paramsSchema!.required || [],
        },
      }));

    return {
      tools: [
        { name: 'register_skill', description: 'Register a new skill', inputSchema: { type: 'object', properties: { appName: { type: 'string' }, skillName: { type: 'string' }, description: { type: 'string' }, paramsSchema: { type: 'object' } }, required: ['appName', 'skillName'] } },
        { name: 'unregister_skill', description: 'Unregister a skill', inputSchema: { type: 'object', properties: { appName: { type: 'string' }, skillName: { type: 'string' } }, required: ['appName', 'skillName'] } },
        { name: 'list_skills', description: 'List all registered skills', inputSchema: { type: 'object', properties: { appName: { type: 'string' } } } },
        { name: 'create_task', description: 'Create a new task', inputSchema: { type: 'object', properties: { skillName: { type: 'string' }, appName: { type: 'string' }, params: { type: 'object' } }, required: ['skillName', 'appName', 'params'] } },
        ...dynamicToolSchemas,
        { name: 'get_task_status', description: 'Get task status', inputSchema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] } },
        { name: 'get_task_result', description: 'Get task result', inputSchema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] } },
        { name: 'list_tasks', description: 'List recent tasks', inputSchema: { type: 'object', properties: { appName: { type: 'string' }, skillName: { type: 'string' }, limit: { type: 'number' } } } },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;
    try {
      switch (name) {
        case 'register_skill': {
          const { appName, skillName, description, paramsSchema } = args as any;
          const skill = registerSkill(appName, skillName, description, paramsSchema);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, skill: { name: skill.name, appName: skill.appName } }, null, 2) }] };
        }
        case 'unregister_skill': {
          const { appName, skillName } = args as { appName: string; skillName: string };
          return { content: [{ type: 'text', text: JSON.stringify({ success: unregisterSkill(appName, skillName) }, null, 2) }] };
        }
        case 'list_skills': {
          const { appName } = args as { appName?: string };
          return { content: [{ type: 'text', text: JSON.stringify(listSkills(appName), null, 2) }] };
        }
        case 'create_task': {
          const { skillName, appName, params } = args as any;
          const task = createTask(skillName, appName, params);
          return { content: [{ type: 'text', text: JSON.stringify({ taskId: task.id, status: task.status }, null, 2) }] };
        }
        case 'get_task_status':
        case 'get_task_result': {
          const { taskId } = args as { taskId: string };
          const task = getTaskResult(taskId);
          if (!task) return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
          return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
        }
        case 'list_tasks': {
          const { appName, skillName, limit = 10 } = args as any;
          return { content: [{ type: 'text', text: JSON.stringify(listTasks(appName, skillName, limit), null, 2) }] };
        }
        default:
          return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { content: [{ type: 'text', text: `Error: ${errorMessage}` }], isError: true };
    }
  });
}

async function main() {
  await startHttpServer(HTTP_PORT);
  
  if (MODE === 'streamable-http' || MODE === 'http') {
    const app = express();
    app.use(cors());
    app.use(express.json());
    
    const servers: Map<string, Server> = new Map();
    const transports: Map<string, StreamableHTTPServerTransport> = new Map();
    
    const createServerWithTransport = (sessionId: string) => {
      const server = new Server({ name: 'rpamcp', version: '1.0.0' }, { capabilities: { tools: {} } });
      setupToolHandlers(server);
      
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => sessionId });
      
      transport.onclose = () => {
        console.log(`Session closed: ${sessionId}`);
        servers.delete(sessionId);
        transports.delete(sessionId);
      };
      
      server.connect(transport).catch(console.error);
      servers.set(sessionId, server);
      transports.set(sessionId, transport);
      
      return { server, transport };
    };
    
    app.all('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      const isFirstRequest = req.body?.method === 'initialize';
      
      console.log(`${req.method} /mcp from ${req.ip}, session: ${sessionId || 'new'}`);
      
      try {
        let transport = sessionId ? transports.get(sessionId) : undefined;
        
        if (!transport) {
          if (isFirstRequest) {
            const { randomUUID } = await import('crypto');
            const newSessionId = randomUUID();
            const { transport: newTransport } = createServerWithTransport(newSessionId);
            res.setHeader('Mcp-Session-Id', newSessionId);
            await newTransport.handleRequest(req, res, req.body);
            return;
          } else {
            return res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Session not initialized' }, id: null });
          }
        }
        
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('MCP error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });
    
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', transport: 'streamable-http', sessions: transports.size });
    });
    
    app.listen(MCP_PORT, '0.0.0.0', () => {
      console.log(`MCP Streamable HTTP running on 0.0.0.0:${MCP_PORT}`);
      console.log(`MCP endpoint: http://0.0.0.0:${MCP_PORT}/mcp`);
    });
  } else {
    const server = new Server({ name: 'rpamcp', version: '1.0.0' }, { capabilities: { tools: {} } });
    setupToolHandlers(server);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server running on stdio');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
