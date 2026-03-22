# RPA MCP Server - 影刀多应用版

MCP Server 用于打通 影刀 RPA + OpenClaw，支持多应用、多技能注册和任务隔离。

## 架构

```
┌─────────────┐     MCP      ┌─────────────┐    HTTP    ┌──────────────┐
│  OpenClaw   │ ◄──────────► │  MCP Server │ ◄────────► │  影刀 RPA A  │
│  (Client)   │              │ (TypeScript)│           │ (app_a)     │
└─────────────┘              └─────────────┘           └──────────────┘
                                    │
                               ┌────┴────┐
                               ▼         ▼
                        ┌───────────┐  ┌───────────┐
                        │  应用 A    │  │  应用 B    │
                        │  任务队列  │  │  任务队列  │
                        │  (隔离)   │  │  (隔离)   │
                        └───────────┘  └───────────┘
```

## 核心特性

### 1. 多应用支持
- 每个影刀应用有独立的任务队列
- 应用之间任务隔离，互不干扰
- 通过 `appName` 参数区分不同应用

### 2. 技能注册机制
- 应用启动时注册自己的技能
- 支持一个应用多个技能
- 动态注册/注销技能

### 3. 任务过滤
- 按应用名称过滤任务
- 按技能名称过滤任务
- 支持组合过滤

## MCP Tools (供 OpenClaw 调用)

| Tool | 描述 | 参数 |
|------|------|------|
| `register_skill` | 注册技能 | `appName`, `skillName`, `description?` |
| `unregister_skill` | 注销技能 | `appName`, `skillName` |
| `list_skills` | 列出技能 | `appName?` |
| `create_task` | 创建任务 | `skillName`, `appName`, `params` |
| `get_task_status` | 查询状态 | `taskId` |
| `get_task_result` | 获取结果 | `taskId` |
| `list_tasks` | 列出任务 | `appName?`, `skillName?`, `limit?` |

## HTTP API (供影刀 RPA 调用)

| Endpoint | 方法 | 描述 |
|----------|------|------|
| `/api/skill/register` | POST | 注册技能 |
| `/api/skill/register` | DELETE | 注销技能 |
| `/api/skills` | GET | 列出技能 |
| `/api/task/next?appName=xxx&skillName=yyy` | GET | 轮询任务 |
| `/api/task/:id/complete` | POST | 提交结果 |
| `/api/task/:id` | GET | 查询任务 |
| `/api/health` | GET | 健康检查 |

## 安装

```bash
pnpm install
```

## 运行

### MCP 模式（OpenClaw 集成）

```bash
pnpm run dev          # 开发模式
pnpm run build        # 构建
pnpm start            # 生产模式
```

### 独立 HTTP 服务（仅测试）

```bash
pnpm run dev:standalone   # 开发模式
pnpm start:standalone     # 生产模式
```

## 使用示例

### 影刀 RPA 应用启动流程

```python
# 影刀 RPA Python 脚本示例

import requests

BASE_URL = "http://localhost:3001"
APP_NAME = "my_data_processor"

# 1. 应用启动时注册技能
def register_skills():
    skills = [
        {"name": "web_scrape", "desc": "网页数据抓取"},
        {"name": "form_fill", "desc": "表单自动填写"},
    ]
    
    for skill in skills:
        requests.post(f"{BASE_URL}/api/skill/register", json={
            "appName": APP_NAME,
            "skillName": skill["name"],
            "description": skill["desc"]
        })
    
    print(f"✅ 应用 {APP_NAME} 注册了 {len(skills)} 个技能")

# 2. 主循环 - 轮询任务
def poll_and_execute():
    while True:
        # 轮询任务（只获取自己应用的任务）
        resp = requests.get(f"{BASE_URL}/api/task/next", 
                          params={"appName": APP_NAME})
        data = resp.json()
        
        if data["task"]:
            task = data["task"]
            print(f"获得任务：{task['skillName']}")
            
            try:
                # 执行任务
                result = execute_task(task)
                
                # 提交结果
                requests.post(f"{BASE_URL}/api/task/{task['id']}/complete",
                            json={"result": result})
                print("✅ 任务完成")
            except Exception as e:
                # 提交错误
                requests.post(f"{BASE_URL}/api/task/{task['id']}/complete",
                            json={"error": str(e)})
        else:
            # 无任务，等待
            time.sleep(5)

# 3. 任务执行器
def execute_task(task):
    skill_name = task["skillName"]
    params = task["params"]
    
    if skill_name == "web_scrape":
        # 执行网页抓取
        return scrape_web(params["url"], params["selector"])
    elif skill_name == "form_fill":
        # 执行表单填写
        return fill_form(params["formId"], params["fields"])
    else:
        raise Exception(f"未知技能：{skill_name}")
```

### OpenClaw 调用示例

```javascript
// 1. 注册技能
await mcp.callTool('register_skill', {
  appName: 'data_processor',
  skillName: 'web_scrape',
  description: '网页数据抓取'
});

// 2. 创建任务
const result = await mcp.callTool('create_task', {
  appName: 'data_processor',
  skillName: 'web_scrape',
  params: {
    url: 'https://example.com',
    selector: '.content'
  }
});
// 返回：{ taskId: "xxx", skillName: "web_scrape", appName: "data_processor" }

// 3. 查询任务状态
const status = await mcp.callTool('get_task_status', { taskId: 'xxx' });

// 4. 获取任务结果
const task = await mcp.callTool('get_task_result', { taskId: 'xxx' });

// 5. 列出应用的技能
const skills = await mcp.callTool('list_skills', { appName: 'data_processor' });
```

## 影刀 RPA 配置

### HTTP 请求节点配置

**注册技能:**
- 方法：POST
- URL: `http://localhost:3001/api/skill/register`
- Body:
```json
{
  "appName": "my_app",
  "skillName": "my_skill",
  "description": "技能描述"
}
```

**轮询任务:**
- 方法：GET
- URL: `http://localhost:3001/api/task/next?appName=my_app`
- 或带技能过滤：`?appName=my_app&skillName=specific_skill`

**提交结果:**
- 方法：POST
- URL: `http://localhost:3001/api/task/{taskId}/complete`
- **注意**: 任务 ID 在 URL 路径中
- Body:
```json
{
  "result": {
    "success": true,
    "data": { /* 你的数据 */ }
  }
}
```

影刀 RPA 示例:
```python
task_id = task["id"]  # 从轮询响应获取
requests.post(f"http://localhost:3001/api/task/{task_id}/complete",
              json={"result": result})
```

## 工作流程

```
1. 影刀应用启动
   ↓
2. 注册技能 (POST /api/skill/register)
   ↓
3. 进入轮询循环 (GET /api/task/next?appName=xxx)
   ↓
4. 获得任务 → 执行 → 提交结果
   ↓
5. 继续轮询...
```

## 测试

```bash
# 影刀多应用测试
pnpm run yingdao

# E2E 测试
pnpm run e2e

# HTTP API 演示
pnpm run demo
```

## 任务状态

- `pending` - 等待执行
- `running` - 正在执行
- `completed` - 已完成
- `failed` - 执行失败

## 集成到 OpenClaw

在 OpenClaw 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "rpamcp": {
      "command": "pnpm",
      "args": ["exec", "tsx", "src/index.ts"],
      "cwd": "/path/to/rpamcp",
      "env": {
        "HTTP_PORT": "3001"
      }
    }
  }
}
```

## 最佳实践

### 1. 应用命名
使用有意义的名称：
- ✅ `data_processor`, `email_sender`, `file_manager`
- ❌ `app1`, `app2`, `test`

### 2. 技能命名
使用动词 + 名词格式：
- ✅ `web_scrape`, `send_email`, `parse_csv`
- ❌ `do_it`, `process`, `task1`

### 3. 错误处理
RPA 应用应该：
- 捕获执行异常
- 提交错误信息（使用 `error` 字段）
- 记录日志便于调试

### 4. 轮询间隔
推荐 3-10 秒：
- 太短：增加服务器负载
- 太长：任务响应慢
