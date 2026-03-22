# RPA MCP Server

本项目是一个 RPA + MCP 集成服务器，提供任务管理和技能注册功能。

## MCP Server 配置

已在 `opencode.json` 中配置了本地 MCP server：

```json
{
  "mcp": {
    "rpamcp": {
      "type": "local",
      "command": ["pnpm", "start"],
      "enabled": true
    }
  }
}
```

## 可用工具

### 技能管理
- `register_skill` - 注册新技能（支持 paramsSchema 定义参数结构）
- `unregister_skill` - 注销技能
- `list_skills` - 列出所有技能

### 任务管理
- `create_task` - 创建任务（通用版本）
- `create_task_<app>_<skill>` - 创建特定技能的任务（带参数验证）
- `get_task_status` - 查询任务状态
- `get_task_result` - 获取任务结果
- `list_tasks` - 列出任务

## 使用示例

### 注册带参数 Schema 的技能

```typescript
// 使用 MCP 工具 register_skill
{
  "appName": "data_processor",
  "skillName": "web_scrape",
  "description": "爬取网页数据",
  "paramsSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "目标 URL" },
      "selector": { "type": "string", "description": "CSS 选择器" }
    },
    "required": ["url"]
  }
}
```

注册后会自动生成 `create_task_data_processor_web_scrape` 工具，包含完整的参数验证。

### HTTP API

- 技能注册：`POST /api/skill/register`
- 获取任务：`GET /api/task/next?appName=xxx&skillName=yyy`
- 完成任务：`POST /api/task/:id/complete`

## 开发命令

```bash
pnpm run build      # 编译 TypeScript
pnpm run start      # 启动 MCP server
pnpm run dev        # 开发模式
```
