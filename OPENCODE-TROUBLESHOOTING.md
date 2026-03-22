# OpenCode MCP 故障排查指南

## 问题症状

在 OpenCode 中启用 MCP rpamcp 失败

## 已修复的问题

### 1. Streamable HTTP 会话管理

**问题**: 服务器返回 `400 Bad Request - Server already initialized`

**原因**: MCP Streamable HTTP 需要正确的会话管理，每个客户端需要独立的 Server 实例和 Session ID

**解决方案**:
- ✅ 每个初始化请求创建新的 Server 实例
- ✅ 返回 `Mcp-Session-Id` 响应头
- ✅ 后续请求携带 `Mcp-Session-Id` 头

### 2. 配置验证

**opencode.json 配置**:
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

**服务器配置** (`ecosystem.config.cjs`):
```javascript
env: {
  MODE: 'streamable-http',
  HTTP_PORT: '3001',
  MCP_PORT: '3002'
}
```

## 验证步骤

### 1. 检查服务状态

```bash
pm2 status rpamcp
# 应显示: online
```

### 2. 测试健康检查

```bash
curl http://192.168.3.7:3002/health
# 返回：{"status":"ok","transport":"streamable-http","sessions":X}
```

### 3. 测试 MCP 初始化

```bash
curl -v -X POST http://192.168.3.7:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
```

**预期响应**:
```
< mcp-session-id: xxx-xxx-xxx
event: message
data: {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"rpamcp","version":"1.0.0"}},"jsonrpc":"2.0","id":1}
```

### 4. 测试 MCP 工具列表

```bash
curl -X POST http://192.168.3.7:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <session-id-from-step-3>" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
```

## OpenCode 中启用的步骤

1. **确保 PM2 服务运行**
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 logs rpamcp --lines 20
   ```

2. **修改 opencode.json**
   - 确认 URL 正确（使用你的服务器 IP）
   - 确保使用 `/mcp` 端点

3. **重启 OpenCode**
   - 关闭并重新打开 OpenCode
   - 检查 OpenCode 日志

4. **验证连接**
   - 在 OpenCode 中尝试使用 MCP 工具
   - 检查 `pm2 logs rpamcp` 查看请求日志

## 常见问题

### Q: Connection refused

**A**: 检查防火墙和端口
```bash
# 检查端口监听
netstat -ano | findstr :3002

# 开放防火墙
netsh advfirewall firewall add rule name="MCP HTTP" dir=in action=allow protocol=TCP localport=3002
```

### Q: Session not initialized

**A**: 确保客户端发送初始化请求并保存 Session ID

### Q: Server already initialized

**A**: 已修复 - 现在每个客户端有独立的 Server 实例

### Q: 404 Not Found

**A**: 检查 URL 路径 - 应该是 `/mcp` 而不是 `/sse`

## 日志查看

```bash
# 实时日志
pm2 logs rpamcp --lines 50

# 查看错误
type logs\pm2-err.log

# 查看访问日志
type logs\pm2-out.log
```

## 成功标志

- ✅ `pm2 status` 显示 online
- ✅ `/health` 返回 session 计数
- ✅ 初始化返回 `Mcp-Session-Id` 头
- ✅ 工具列表调用成功
- ✅ OpenCode 可以使用 MCP 工具

## 联系支持

如果问题仍然存在：
1. 收集 PM2 日志
2. 检查网络连通性
3. 验证 opencode.json 配置
4. 尝试手动 curl 测试
