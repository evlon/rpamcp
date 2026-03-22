# MCP 远程访问故障排查

## 当前状态

- **服务器 IP**: `192.168.3.7`
- **MCP SSE 端口**: `3002`
- **HTTP API 端口**: `3001`
- **PM2 状态**: 运行中

## 测试步骤

### 1. 本地测试

```bash
# 测试 SSE 端点
curl -m 2 http://192.168.3.7:3002/sse

# 应返回:
# event: endpoint
# data: /message?sessionId=xxx
```

### 2. 远程测试（从其他机器）

```bash
# 在另一台机器上测试
curl -m 2 http://192.168.3.7:3002/sse
```

### 3. 防火墙检查

```bash
# 查看防火墙规则
netsh advfirewall firewall show rule name=all | findstr "3002"
netsh advfirewall firewall show rule name=all | findstr "3001"
```

### 4. 端口监听检查

```bash
# 查看端口绑定
netstat -ano | findstr :3002
# 应显示：0.0.0.0:3002 LISTENING
```

## OpenClaw 配置

在客户端机器的 `opencode.json` 中配置：

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

## 常见问题

### 问题 1: 连接超时

**症状**: curl 返回 timeout

**解决**:
1. 检查防火墙是否开放 3002 端口
2. 确认服务器 IP 正确
3. 确认 PM2 服务运行正常

```bash
# 开放防火墙
netsh advfirewall firewall add rule name="MCP SSE" dir=in action=allow protocol=TCP localport=3002

# 重启服务
pm2 restart rpamcp
```

### 问题 2: 连接被拒绝

**症状**: Connection refused

**解决**:
1. 检查 PM2 服务状态
2. 查看 PM2 日志

```bash
pm2 status
pm2 logs rpamcp --lines 50
```

### 问题 3: sessionId 不匹配

**症状**: Message endpoint 返回 400

**原因**: SSE 连接断开后，客户端仍使用旧的 sessionId

**解决**: 客户端需要重新建立 SSE 连接获取新的 sessionId

### 问题 4: OpenClaw 无法连接

**检查**:
1. 确认 opencode.json 配置正确
2. 查看 OpenClaw 日志
3. 确认客户端和服务器在同一网络

## 日志查看

```bash
# 实时查看日志
pm2 logs rpamcp --lines 100

# 查看错误日志
type logs\pm2-err.log

# 查看输出日志
type logs\pm2-out.log
```

## 重启服务

```bash
# 完整重启
pm2 stop rpamcp
pm2 start ecosystem.config.cjs
pm2 logs rpamcp --lines 20
```

## 验证清单

- [ ] PM2 服务运行正常
- [ ] 端口 3001 和 3002 监听正常
- [ ] 防火墙规则已添加
- [ ] 本地 curl 测试成功
- [ ] 远程机器可以 ping 通服务器
- [ ] opencode.json 配置正确
