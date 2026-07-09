const { spawn } = require('child_process');

console.log('📡 Starting ERP LE CANAPÉ (Client & Server)...');

// Start backend server
const server = spawn('npm', ['run', 'dev'], { 
  cwd: './server', 
  stdio: 'inherit', 
  shell: true 
});

// Start frontend client
const client = spawn('npm', ['run', 'dev'], { 
  cwd: './client', 
  stdio: 'inherit', 
  shell: true 
});

// Handle termination signals to clean up child processes
const cleanup = () => {
  console.log('\nStopping servers...');
  server.kill();
  client.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
