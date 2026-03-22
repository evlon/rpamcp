#!/bin/bash
# MCP 连接测试脚本

SERVER_IP="192.168.3.7"
MCP_PORT="3002"
HTTP_PORT="3001"

echo "=== RPA MCP Server 连接测试 ==="
echo ""

# 测试 1: HTTP API 健康检查
echo "1. 测试 HTTP API 健康检查..."
curl -s http://${SERVER_IP}:${HTTP_PORT}/api/health
echo ""
echo ""

# 测试 2: SSE 端点连接
echo "2. 测试 SSE 端点 (2 秒超时)..."
curl -m 2 http://${SERVER_IP}:${MCP_PORT}/sse 2>&1 | head -3
echo ""
echo ""

# 测试 3: 技能注册
echo "3. 测试技能注册..."
curl -s -X POST http://${SERVER_IP}:${HTTP_PORT}/api/skill/register \
  -H "Content-Type: application/json" \
  -d '{"appName":"test","skillName":"hello","description":"Hello World"}'
echo ""
echo ""

# 测试 4: 获取技能列表
echo "4. 测试获取技能列表..."
curl -s http://${SERVER_IP}:${HTTP_PORT}/api/skills
echo ""
echo ""

# 测试 5: 创建任务
echo "5. 测试创建任务..."
curl -s -X POST http://${SERVER_IP}:${HTTP_PORT}/api/task/create \
  -H "Content-Type: application/json" \
  -d '{"appName":"test","skillName":"hello","params":{"message":"Hi"}}'
echo ""
echo ""

# 测试 6: 获取任务列表
echo "6. 测试获取任务列表..."
curl -s http://${SERVER_IP}:${HTTP_PORT}/api/task/next?appName=test
echo ""
echo ""

echo "=== 测试完成 ==="
