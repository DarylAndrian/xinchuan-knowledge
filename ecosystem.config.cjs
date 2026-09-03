module.exports = {
  apps: [{
    name: 'xinchuan',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3001',
    cwd: 'C:\\Users\\hokishop jayajaya\\Code-Arena\\xinchuan-knowledge',
    instances: 1,
    autorestart: true,
    watch: false,
    treekill: false, // do NOT tree-kill: auto-deploy finisher must survive restart
    max_memory_restart: '1000M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: 'C:\\Users\\hokishop jayajaya\\Code-Arena\\xinchuan-knowledge\\logs\\error.log',
    out_file: 'C:\\Users\\hokishop jayajaya\\Code-Arena\\xinchuan-knowledge\\logs\\output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
