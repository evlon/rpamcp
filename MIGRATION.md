# Streamable HTTP 迁移说明

## 变更概述

已将 MCP 传输从 SSE (Server-Sent Events) 升级为 **Streamable HTTP**，这是 MCP 官方推荐的新一代传输协议。

## 主要改进

### 1. 更简单的协议
- 使用标准的 HTTP POST 请求
- 不需要单独的 SSE 连接和消息端点
- 单一端点 `/mcp` 处理所有通信

### 2. 更好的兼容性
- 支持双向通信
- 支持 SSE 流式响应和直接 HTTP 响应
- 更符合现代 Web 标准

### 3. 会话管理
- 自动会话 ID 生成
- 会话状态维护
- 支持有状态和无状态模式

## 端点变更

| 旧 (SSE) | 新 (Streamable HTTP) |
|----------|---------------------|
| GET `/sse` | POST `/mcp` |
| POST `/message?sessionId=xxx` | POST `/mcp` |
| - | GET `/health` (健康检查) |

## 配置变更

### opencode.json

**之前:**
```json
{
  "mcp": {
    "rpamcp": {
      "type": "remote",
      "url": "http://192.168.3.7:3002/sse"
    }
  }
}
```

**现在:**
```json
{
  "mcp": {
    "rpamcp": {
      "type": "remote",
      "url": "http://192.168.3.7:3002/mcp"
    }
  }
}
```

### ecosystem.config.cjs

**之前:**
```javascript
env: {
  MODE: 'sse'
}
```

**现在:**
```javascript
env: {
  MODE: 'streamable-http'
}
```

## 依赖升级

```json
{
  "@modelcontextprotocol/sdk": "^1.27.0",
  "@hono/node-server": "^1.19.11"
}
```

## 测试

### 健康检查
```bash
curl http://localhost:3002/health
# 返回：{"status":"ok","transport":"streamable-http"}
```

### MCP 请求示例
```bash
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
```

## 迁移步骤

1. **停止服务**
   ```bash
   pm2 stop rpamcp
   ```

2. **更新代码**
   ```bash
   git pull
   pnpm install
   pnpm run build
   ```

3. **更新配置**
   - 修改 `ecosystem.config.cjs` 中的 `MODE` 为 `streamable-http`
   - 修改客户端 `opencode.json` 中的 URL 为 `/mcp`

4. **重启服务**
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 logs rpamcp --lines 20
   ```

5. **验证**
   ```bash
   curl http://localhost:3002/health
   ```

## 开发模式

```bash
# 本地开发
pnpm run dev:http

# 生产测试
pnpm run start:http
```

## 注意事项

1. **客户端兼容性**: 确保 MCP 客户端支持 Streamable HTTP 传输
2. **会话管理**: 客户端需要在后续请求中携带 `Mcp-Session-Id` 头
3. **防火墙**: 确认端口 3002 已开放

## 回滚 (如果需要)

如果遇到问题需要回滚到 SSE 模式：

1. 修改 `ecosystem.config.cjs`:
   ```javascript
   MODE: 'sse'
   ```

2. 修改 `opencode.json`:
   ```json
   "url": "http://192.168.3.7:3002/sse"
   ```

3. 降级 SDK:
   ```bash
   pnpm add @modelcontextprotocol/sdk@0.5.0
   pnpm run build
   pm2 restart rpamcp
   ```

## 参考文档

- [MCP Streamable HTTP 规范](https://spec.modelcontextprotocol.io/architecture/transports/streamable-http/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
