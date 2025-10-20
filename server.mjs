import http from 'node:http';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import { Client } from 'ssh2';
import database from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Store active SSH connections
const activeConnections = new Map();

// Initialize database
async function initDatabase() {
    try {
        await database.init();
        await database.migrateFromJSON();
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    }
}

// Serve static files
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // API endpoints for session management
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }

  // Serve favicon
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve static files
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const extname = path.extname(filePath);
  let contentType = 'text/html';
  
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
    case '.ico':
      contentType = 'image/x-icon';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.message);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Handle API requests
function handleApi(req, res) {
  if (req.url.startsWith('/api/sessions')) {
    handleSessionApi(req, res);
  } else if (req.url.startsWith('/api/groups')) {
    handleGroupApi(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
  }
}

// Handle session API requests
async function handleSessionApi(req, res) {
  const urlParts = req.url.split('/');
  const sessionId = urlParts[3];
  
  if (req.method === 'GET') {
    try {
      // Return all sessions (without sensitive data for security)
      const sessions = await database.getAllSessions();
      const sessionsArray = sessions.map(session => ({
        id: session.id,
        name: session.name,
        host: session.host,
        port: session.port,
        username: session.username,
        auth: session.auth,
        groupId: session.group_id,
        groupName: session.group_name,
        createdAt: session.created_at
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sessionsArray));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load sessions' }));
    }
  } else if (req.method === 'POST' && !sessionId) {
    // Create new session
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const sessionData = JSON.parse(body);
        const newSessionId = await database.createSession({
          name: sessionData.name || `Session ${Date.now()}`,
          host: sessionData.host,
          port: sessionData.port || 22,
          username: sessionData.username,
          auth: sessionData.auth,
          password: sessionData.password,
          privateKey: sessionData.privateKey,
          passphrase: sessionData.passphrase,
          groupId: sessionData.groupId ? parseInt(sessionData.groupId) : null
        });
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: newSessionId }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON or database error' }));
      }
    });
  } else if (req.method === 'PUT' && sessionId) {
    // Update session
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const sessionData = JSON.parse(body);
        await database.updateSession(parseInt(sessionId), {
          name: sessionData.name,
          host: sessionData.host,
          port: sessionData.port || 22,
          username: sessionData.username,
          auth: sessionData.auth,
          password: sessionData.password,
          privateKey: sessionData.privateKey,
          passphrase: sessionData.passphrase,
          groupId: sessionData.groupId ? parseInt(sessionData.groupId) : null
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: parseInt(sessionId) }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON or database error' }));
      }
    });
  } else if (req.method === 'POST' && sessionId && urlParts[4] === 'move') {
    // Move session to group
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const moveData = JSON.parse(body);
        await database.moveSessionToGroup(
          parseInt(sessionId), 
          moveData.groupId ? parseInt(moveData.groupId) : null
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON or database error' }));
      }
    });
  } else if (req.method === 'DELETE' && sessionId) {
    // Delete session
    try {
      await database.deleteSession(parseInt(sessionId));
      res.writeHead(204);
      res.end();
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to delete session' }));
    }
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
}

// Handle group API requests
async function handleGroupApi(req, res) {
  const urlParts = req.url.split('/');
  const groupId = urlParts[3];
  
  if (req.method === 'GET') {
    try {
      // Return all groups
      const groups = await database.getAllGroups();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(groups));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load groups' }));
    }
  } else if (req.method === 'POST' && !groupId) {
    // Create new group
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const groupData = JSON.parse(body);
        const groupId = await database.createGroup(groupData.name || `Group ${Date.now()}`);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: groupId }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON or database error' }));
      }
    });
  } else if (req.method === 'DELETE' && groupId) {
    // Delete group (move all sessions to ungrouped)
    try {
      await database.deleteGroup(parseInt(groupId));
      res.writeHead(204);
      res.end();
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to delete group' }));
    }
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
}

// WebSocket server for SSH connections with performance optimizations
const wss = new WebSocketServer({ 
  server,
  // Performance optimizations for Docker
  perMessageDeflate: false, // Disable compression for better performance
  maxPayload: 16 * 1024 * 1024, // 16MB max payload
  handshakeTimeout: 10000, // 10 second timeout
  // Enable keep-alive
  keepAlive: true,
  keepAliveInitialDelay: 0
});

wss.on('connection', (ws, req) => {
  let sshClient = null;
  let stream = null;
  let sftp = null;
  let isClientConnected = false;
  let connectionId = null;

  ws.on('message', async (message) => {
    try {
      // Convert message to string if it's a Buffer or ArrayBuffer
      let messageStr = message;
      if (message instanceof Buffer) {
        messageStr = message.toString();
      } else if (message instanceof ArrayBuffer) {
        messageStr = new TextDecoder().decode(message);
      } else if (message instanceof Uint8Array) {
        messageStr = new TextDecoder().decode(message);
      }
      
      // Try to parse as JSON first
      let data;
      try {
        data = JSON.parse(messageStr);
      } catch (parseError) {
        // Binary data - send to SSH stream if connected
        if (stream && isClientConnected) {
          stream.write(message);
        }
        return;
      }
      
      if (data.type === 'connect') {
        // Check if this is a reconnect with session ID
        let sshConfig;
        if (data.sessionId) {
          // Get full session data with credentials
          const session = await database.getSessionById(data.sessionId);
          if (!session) {
            ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
            return;
          }
          
          // Use stored credentials
          sshConfig = {
            host: session.host,
            port: parseInt(session.port, 10),
            username: session.username,
            readyTimeout: 20000,
            keepaliveInterval: 15000,
            keepaliveCountMax: 10,
            algorithms: {
              cipher: [
                'aes128-ctr',
                'aes192-ctr',
                'aes256-ctr',
                'aes128-gcm',
                'aes128-gcm@openssh.com',
                'aes256-gcm',
                'aes256-gcm@openssh.com'
              ]
            },
            strictVendor: false,
            hostHash: 'sha1',
            hostVerifier: () => true
          };
          
          // Authentication with stored credentials
          if (session.auth === 'password' && session.password) {
            sshConfig.password = session.password;
          } else if (session.auth === 'privateKey' && session.privateKey) {
            sshConfig.privateKey = session.privateKey;
            if (session.passphrase) {
              sshConfig.passphrase = session.passphrase;
            }
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'No valid credentials stored for this session' }));
            return;
          }
        } else {
          // Validate input for direct connection
          if (!data.host || !data.username) {
            ws.send(JSON.stringify({ type: 'error', message: 'Host and username are required' }));
            return;
          }
          
          if (!data.port || isNaN(data.port)) {
            data.port = 22;
          }
          
          sshConfig = {
            host: data.host,
            port: parseInt(data.port, 10),
            username: data.username,
            readyTimeout: 20000,
            keepaliveInterval: 15000,
            keepaliveCountMax: 10,
            algorithms: {
              cipher: [
                'aes128-ctr',
                'aes192-ctr',
                'aes256-ctr',
                'aes128-gcm',
                'aes128-gcm@openssh.com',
                'aes256-gcm',
                'aes256-gcm@openssh.com'
              ]
            },
            strictVendor: false,
            hostHash: 'sha1',
            hostVerifier: () => true
          };
          
          // Authentication with provided credentials
          if (data.auth === 'password' && data.password) {
            sshConfig.password = data.password;
          } else if (data.auth === 'privateKey' && data.privateKey) {
            sshConfig.privateKey = data.privateKey;
            if (data.passphrase) {
              sshConfig.passphrase = data.passphrase;
            }
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication method not provided or invalid' }));
            return;
          }
        }
        
        // Create SSH connection
        sshClient = new Client();
        connectionId = data.sessionId || Date.now().toString();
        
        sshClient.on('ready', () => {
          isClientConnected = true;
          
          // Store the connection
          activeConnections.set(connectionId, { sshClient, sftp: null });
          
          // Start shell session
          sshClient.shell({
            term: 'xterm-256color'
          }, (err, strm) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'error', message: 'Cannot start shell: ' + err.message }));
              sshClient.end();
              return;
            }
            
            stream = strm;
            
            stream.on('data', (chunk) => {
              if (ws.readyState === WebSocket.OPEN && isClientConnected) {
                // Optimize data sending for Docker
                try {
                  ws.send(chunk);
                } catch (error) {
                  console.error('WebSocket send error:', error);
                  isClientConnected = false;
                }
              }
            });
            
            stream.on('close', () => {
              isClientConnected = false;
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'disconnected' }));
              }
              // Clean up SFTP connection if it exists
              if (sftp) {
                try {
                  sftp.end();
                } catch (e) {
                  // Ignore errors when closing SFTP
                }
              }
              activeConnections.delete(connectionId);
              sshClient.end();
            });
            
            stream.on('error', (err) => {
              isClientConnected = false;
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: 'Shell error: ' + err.message }));
              }
              // Clean up SFTP connection if it exists
              if (sftp) {
                try {
                  sftp.end();
                } catch (e) {
                  // Ignore errors when closing SFTP
                }
              }
              activeConnections.delete(connectionId);
              sshClient.end();
            });
            
            // Send connected message only after shell is ready
            ws.send(JSON.stringify({ type: 'connected' }));
          });
        });
        
        sshClient.on('error', (err) => {
          isClientConnected = false;
          let errorMessage = err.message;
          if (err.level === 'authentication') {
            errorMessage = 'Authentication failed. Please check your credentials.';
          } else if (err.level === 'connection') {
            errorMessage = 'Connection failed. Please check the host and port.';
          } else if (err.level === 'protocol') {
            errorMessage = 'Protocol error: ' + err.message;
          } else if (err.code === 'ENOTFOUND') {
            errorMessage = 'Host not found. Please check the hostname.';
          } else if (err.code === 'ECONNREFUSED') {
            errorMessage = 'Connection refused. Please check if SSH is running on the target host.';
          } else if (err.code === 'ETIMEDOUT') {
            errorMessage = 'Connection timed out. Please check network connectivity.';
          }
          ws.send(JSON.stringify({ type: 'error', message: errorMessage }));
        });
        
        sshClient.on('close', () => {
          isClientConnected = false;
          if (ws.readyState === WebSocket.OPEN && isClientConnected) {
            ws.send(JSON.stringify({ type: 'disconnected' }));
          }
          // Clean up SFTP connection if it exists
          if (sftp) {
            try {
              sftp.end();
            } catch (e) {
              // Ignore errors when closing SFTP
            }
          }
          activeConnections.delete(connectionId);
        });
        
        sshClient.on('end', () => {
          isClientConnected = false;
          if (ws.readyState === WebSocket.OPEN && isClientConnected) {
            ws.send(JSON.stringify({ type: 'disconnected' }));
          }
          // Clean up SFTP connection if it exists
          if (sftp) {
            try {
              sftp.end();
            } catch (e) {
              // Ignore errors when closing SFTP
            }
          }
          activeConnections.delete(connectionId);
        });
        
        try {
          sshClient.connect(sshConfig);
        } catch (err) {
          isClientConnected = false;
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to initiate connection: ' + err.message }));
        }
      } else if (data.type === 'sftp_init') {
        // Initialize SFTP subsystem
        if (!sshClient || !isClientConnected) {
          ws.send(JSON.stringify({ type: 'sftp_error', message: 'SSH connection not established' }));
          return;
        }
        
        try {
          // Check if SFTP is already initialized
          const connection = activeConnections.get(connectionId);
          if (connection && connection.sftp) {
            // SFTP already initialized
            ws.send(JSON.stringify({ type: 'sftp_ready' }));
            return;
          }
          
          // Get SFTP connection
          sftp = await new Promise((resolve, reject) => {
            sshClient.sftp((err, sftp) => {
              if (err) {
                reject(new Error('Failed to initialize SFTP: ' + (err.message || 'Unknown error')));
              } else {
                resolve(sftp);
              }
            });
          });
          
          // Store SFTP connection
          if (connectionId) {
            const connection = activeConnections.get(connectionId);
            if (connection) {
              connection.sftp = sftp;
              activeConnections.set(connectionId, connection);
            }
          }
          
          // Send success response
          ws.send(JSON.stringify({ type: 'sftp_ready' }));
        } catch (err) {
          const errorMessage = 'Failed to initialize SFTP: ' + (err.message || 'Unknown error');
          console.error('SFTP Init Error:', errorMessage);
          ws.send(JSON.stringify({ type: 'sftp_error', message: errorMessage }));
        }
      } else if (data.type === 'sftp_readdir') {
        // List directory contents
        if (!sftp) {
          ws.send(JSON.stringify({ type: 'sftp_error', message: 'SFTP not initialized' }));
          return;
        }
        
        try {
          // Handle different path cases
          let pathToRead = data.path;
          if (pathToRead === '.' || pathToRead === '~') {
            pathToRead = './';
          } else if (pathToRead === '/') {
            pathToRead = '/';
          }
          
          const list = await new Promise((resolve, reject) => {
            sftp.readdir(pathToRead, (err, list) => {
              if (err) {
                // Try with trailing slash for directories
                if (pathToRead !== '/' && !pathToRead.endsWith('/')) {
                  sftp.readdir(pathToRead + '/', (err2, list2) => {
                    if (err2) {
                      // Try to get current directory as fallback
                      sftp.readdir('./', (err3, list3) => {
                        if (err3) {
                          reject(new Error('Failed to read directory: ' + (err.message || err2.message || err3.message || 'No such file or directory')));
                        } else {
                          resolve(list3);
                        }
                      });
                    } else {
                      resolve(list2);
                    }
                  });
                } else {
                  // Try to get current directory as fallback
                  sftp.readdir('./', (err2, list2) => {
                    if (err2) {
                      reject(new Error('Failed to read directory: ' + (err.message || err2.message || 'No such file or directory')));
                    } else {
                      resolve(list2);
                    }
                  });
                }
              } else {
                resolve(list);
              }
            });
          });
          
          // Format the response
          const formattedList = list.map(item => ({
            filename: item.filename,
            longname: item.longname,
            attrs: item.attrs,
            isDirectory: item.attrs.isDirectory(),
            isFile: item.attrs.isFile(),
            size: item.attrs.size,
            mtime: item.attrs.mtime,
            atime: item.attrs.atime
          }));
          
          ws.send(JSON.stringify({ 
            type: 'sftp_readdir_result', 
            path: data.path,
            files: formattedList 
          }));
        } catch (err) {
          const errorMessage = 'Failed to read directory: ' + (err.message || 'Unknown error');
          console.error('SFTP ReadDir Error:', errorMessage);
          ws.send(JSON.stringify({ type: 'sftp_error', message: errorMessage }));
        }
      } else if (data.type === 'sftp_stat') {
        // Get file stats
        if (!sftp) {
          ws.send(JSON.stringify({ type: 'sftp_error', message: 'SFTP not initialized' }));
          return;
        }
        
        try {
          const stats = await new Promise((resolve, reject) => {
            sftp.stat(data.path, (err, stats) => {
              if (err) {
                reject(new Error('Failed to get file stats: ' + (err.message || 'File not found')));
              } else {
                resolve(stats);
              }
            });
          });
          
          ws.send(JSON.stringify({ 
            type: 'sftp_stat_result', 
            path: data.path,
            stats: {
              isDirectory: stats.isDirectory(),
              isFile: stats.isFile(),
              size: stats.size,
              mtime: stats.mtime,
              atime: stats.atime
            }
          }));
        } catch (err) {
          const errorMessage = 'Failed to get file stats: ' + (err.message || 'Unknown error');
          console.error('SFTP Stat Error:', errorMessage);
          ws.send(JSON.stringify({ type: 'sftp_error', message: errorMessage }));
        }
      } else if (data.type === 'sftp_download_file') {
        // Download a single file
        if (!sftp) {
          ws.send(JSON.stringify({ type: 'sftp_error', message: 'SFTP not initialized' }));
          return;
        }
        
        try {
          // Create a buffer to store file data
          let fileData = [];
          
          const readStream = sftp.createReadStream(data.filepath);
          
          readStream.on('data', (chunk) => {
            fileData.push(chunk);
          });
          
          readStream.on('end', () => {
            // Concatenate all chunks
            const buffer = Buffer.concat(fileData);
            
            // Send file data back to client
            ws.send(JSON.stringify({ 
              type: 'sftp_file_data',
              fileId: data.fileId,
              data: buffer
            }));
          });
          
          readStream.on('error', (err) => {
            const errorMessage = 'Failed to download file: ' + (err.message || 'Unknown error');
            console.error('SFTP Download Error:', errorMessage);
            ws.send(JSON.stringify({ 
              type: 'sftp_error', 
              message: errorMessage,
              fileId: data.fileId
            }));
          });
        } catch (err) {
          const errorMessage = 'Failed to download file: ' + (err.message || 'Unknown error');
          console.error('SFTP Download Error:', errorMessage);
          ws.send(JSON.stringify({ 
            type: 'sftp_error', 
            message: errorMessage,
            fileId: data.fileId
          }));
        }
      } else if (data.type === 'sftp_upload_file') {
        // Upload a single file
        if (!sftp) {
          ws.send(JSON.stringify({ type: 'sftp_error', message: 'SFTP not initialized' }));
          return;
        }
        
        try {
          // Convert data back to buffer
          const fileData = Buffer.from(data.data);
          
          // Create write stream for the file
          const writeStream = sftp.createWriteStream(data.filepath);
          
          writeStream.on('close', () => {
            // Send success response
            ws.send(JSON.stringify({ 
              type: 'sftp_upload_success',
              fileId: data.fileId,
              filename: data.filename
            }));
          });
          
          writeStream.on('error', (err) => {
            const errorMessage = 'Failed to upload file: ' + (err.message || 'Unknown error');
            console.error('SFTP Upload Error:', errorMessage);
            ws.send(JSON.stringify({ 
              type: 'sftp_error', 
              message: errorMessage,
              fileId: data.fileId
            }));
          });
          
          // Write data to the file
          writeStream.write(fileData);
          writeStream.end();
        } catch (err) {
          const errorMessage = 'Failed to upload file: ' + (err.message || 'Unknown error');
          console.error('SFTP Upload Error:', errorMessage);
          ws.send(JSON.stringify({ 
            type: 'sftp_error', 
            message: errorMessage,
            fileId: data.fileId
          }));
        }
      } else if (data.type === 'data' && stream && isClientConnected) {
        stream.write(data.data);
      } else if (data.type === 'resize' && stream) {
        if (stream.setWindow) {
          stream.setWindow(data.rows, data.cols, data.height, data.width);
        }
      }
    } catch (err) {
      const errorMessage = 'Server error: ' + (err.message || 'Unknown error');
      console.error('WebSocket Message Error:', errorMessage);
      ws.send(JSON.stringify({ type: 'error', message: errorMessage }));
    }
  });
  
  ws.on('close', () => {
    isClientConnected = false;
    // Clean up SFTP connection if it exists
    if (sftp) {
      try {
        sftp.end();
      } catch (e) {
        // Ignore errors when closing SFTP
      }
    }
    if (connectionId) {
      activeConnections.delete(connectionId);
    }
    if (sshClient) {
      sshClient.end();
    }
  });
  
  ws.on('error', (err) => {
    isClientConnected = false;
    console.error('WebSocket Error:', err.message);
  });
});

// Initialize database and start server
async function startServer() {
  await initDatabase();
  
  server.listen(PORT, () => {
    console.log(`Hub-SSH server running on http://localhost:${PORT}`);
    console.log('Database: SQLite');
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});