module.exports = {
  apps: [{
    name: 'rpamcp',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      HTTP_PORT: '3001',
      MCP_PORT: '3002',
      MODE: 'streamable-http'
    },
    error_file: './logs/pm2-err.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M',
    watch: false
  }]
}
