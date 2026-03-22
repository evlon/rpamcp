# RPA MCP Server 部署指南

## 快速开始

### 1. 构建项目

```bash
pnpm install
pnpm run build
```

### 2. 使用 PM2 启动服务

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### 3. 验证服务

```bash
# 检查服务状态
pm2 status

# 查看日志
pm2 logs rpamcp

# 测试 HTTP API
curl http://localhost:3001/api/health

# 测试 MCP Streamable HTTP 端点
curl http://localhost:3002/health
```

## 端口说明

| 端口 | 用途 | 说明 |
|------|------|------|
| 3001 | HTTP API | 影刀 RPA 轮询任务、注册技能 |
| 3002 | MCP Streamable HTTP | OpenClaw 远程 MCP 连接 |

## 远程访问配置

### 获取服务器 IP

```bash
# Windows
ipconfig

# 查找 IPv4 地址，例如 192.168.3.7
```

### OpenClaw 配置

在客户端的 `opencode.json` 中配置：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "rpamcp": {
      "type": "remote",
      "url": "http://<服务器 IP>:3002/mcp"
    }
  }
}
```

示例：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "rpamcp": {
      "type": "remote",
      "url": "http://192.168.3.7:3002/mcp"
    }
  }
}
```
  }
}
```

示例：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "rpamcp": {
      "type": "remote",
      "url": "http://192.168.3.8:3002/sse"
    }
  }
}
```

## OpenClaw 配置

### 方式 1：Remote 模式（PM2 管理，推荐）

使用 PM2 启动服务后，在 OpenClaw 的 `opencode.json` 中配置：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "rpamcp": {
      "type": "remote",
      "url": "http://<服务器 IP>:3002/sse"
    }
  }
}
```

示例（本地访问）：
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "rpamcp": {
      "type": "remote",
      "url": "http://192.168.3.7:3002/sse"
    }
  }
}
```

### 方式 2：Local 模式（OpenClaw 管理）

在 `opencode.json` 中配置：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "rpamcp": {
      "type": "local",
      "command": "pnpm",
      "args": ["start"],
      "cwd": "C:\\Users\\Administrator\\projects\\rpamcp"
    }
  }
}
```

**注意**：使用 Local 模式时，不要同时用 PM2 启动，避免端口冲突。

## 环境变量

在 `ecosystem.config.cjs` 中配置：

```javascript
env: {
  NODE_ENV: 'production',
  HTTP_PORT: '3001',    // HTTP API 端口
  MCP_PORT: '3002',     // MCP SSE 端口
  MODE: 'sse',          // 运行模式：stdio | sse
  HOST: '0.0.0.0'       // 监听地址
}
```

## PM2 常用命令

```bash
# 启动服务
pm2 start ecosystem.config.cjs

# 停止服务
pm2 stop rpamcp

# 重启服务
pm2 restart rpamcp

# 查看状态
pm2 status

# 查看日志
pm2 logs rpamcp

# 实时日志
pm2 logs rpamcp --lines 100

# 删除服务
pm2 delete rpamcp

# 开机自启
pm2 startup
pm2 save
```

## 防火墙配置

如果其他机器无法访问，需要开放端口：

```bash
# Windows 防火墙（管理员 PowerShell）
New-NetFirewallRule -DisplayName "RPA MCP HTTP" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "RPA MCP SSE" -Direction Inbound -LocalPort 3002 -Protocol TCP -Action Allow
```

## 测试连接

### 本地测试

```bash
# 测试 HTTP API
curl http://localhost:3001/api/health

# 测试 SSE 连接
curl http://localhost:3002/sse
```

### 远程测试

```bash
# 从其他机器测试
curl http://<服务器IP>:3001/api/health
curl http://<服务器IP>:3002/sse
```

## 故障排查

### 端口被占用

```bash
# 查看端口占用
netstat -ano | findstr :3001
netstat -ano | findstr :3002

# 结束占用进程
taskkill /F /PID <进程ID>
```

### 服务无法启动

```bash
# 查看详细日志
pm2 logs rpamcp --lines 100

# 检查 PM2 状态
pm2 status

# 重新构建
pnpm run build
pm2 restart rpamcp
```

### SSE 连接问题

确保：
1. 防火墙已开放 3002 端口
2. 使用正确的 URL 格式：`http://IP:3002/sse`
3. 服务器监听 `0.0.0.0` 而不是 `localhost`

## 安全建议

1. **内网使用**：建议在受信任的内网环境中使用
2. **端口限制**：只开放必要的端口（3001, 3002）
3. **定期更新**：保持依赖项更新
4. **监控日志**：定期检查 PM2 日志
