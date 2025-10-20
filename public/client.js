// Initialize xterm.js
const term = new Terminal({
    cursorBlink: true,
    fontFamily: 'Fira Code, Consolas, monospace',
    fontSize: 14,
    theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#64ffda',
        black: '#1e1e1e',
        red: '#f48771',
        green: '#64ffda',
        yellow: '#ffd166',
        blue: '#4db8ff',
        magenta: '#c792ea',
        cyan: '#89ddff',
        white: '#ffffff',
        brightBlack: '#666666',
        brightRed: '#f48771',
        brightGreen: '#64ffda',
        brightYellow: '#ffd166',
        brightBlue: '#4db8ff',
        brightMagenta: '#c792ea',
        brightCyan: '#89ddff',
        brightWhite: '#ffffff'
    }
});

// Fit addon for responsive terminal
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);

// DOM Elements
const connectionForm = document.getElementById('connection-form');
const connectionPanel = document.getElementById('connection-panel');
const terminalContainer = document.getElementById('terminal-container');
const terminalElement = document.getElementById('terminal');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const statusElement = document.getElementById('status');
const connectionInfo = document.getElementById('connection-info');
const authMethodSelect = document.getElementById('auth-method');
const passwordAuth = document.getElementById('password-auth');
const keyAuth = document.getElementById('key-auth');

// WebSocket connection
let socket = null;
let isConnected = false;

// Authentication method toggle
authMethodSelect.addEventListener('change', () => {
    if (authMethodSelect.value === 'password') {
        passwordAuth.classList.remove('hidden');
        keyAuth.classList.add('hidden');
    } else {
        passwordAuth.classList.add('hidden');
        keyAuth.classList.remove('hidden');
    }
});

// Initialize terminal
term.open(terminalElement);
fitAddon.fit();

// Handle window resize
window.addEventListener('resize', () => {
    fitAddon.fit();
    if (socket && socket.readyState === WebSocket.OPEN && isConnected) {
        const dimensions = fitAddon.proposeDimensions();
        if (dimensions) {
            socket.send(JSON.stringify({
                type: 'resize',
                cols: dimensions.cols,
                rows: dimensions.rows,
                width: dimensions.width,
                height: dimensions.height
            }));
        }
    }
});

// Terminal input handling
term.onData((data) => {
    console.log('🔴 КЛИЕНТ: отправляю данные:', data, 'длина:', data.length, 'коды:', [...data].map(c => c.charCodeAt(0)));
    if (socket && socket.readyState === WebSocket.OPEN && isConnected) {
        socket.send(JSON.stringify({
            type: 'data',
            data: data
        }));
    }
});

// Connection form submission
connectionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const host = document.getElementById('host').value.trim();
    const port = document.getElementById('port').value.trim();
    const username = document.getElementById('username').value.trim();
    const authMethod = document.getElementById('auth-method').value;
    
    // Validation
    if (!host) {
        updateStatus('Host is required', 'error');
        return;
    }
    
    if (!username) {
        updateStatus('Username is required', 'error');
        return;
    }
    
    const connectionData = {
        type: 'connect',
        host: host,
        port: port || 22,
        username: username,
        auth: authMethod
    };
    
    if (authMethod === 'password') {
        const password = document.getElementById('password').value;
        if (!password) {
            updateStatus('Password is required', 'error');
            return;
        }
        connectionData.password = password;
    } else {
        const privateKey = document.getElementById('private-key').value.trim();
        const passphrase = document.getElementById('passphrase').value;
        
        if (!privateKey) {
            updateStatus('Private key is required', 'error');
            return;
        }
        
        connectionData.privateKey = privateKey;
        if (passphrase) {
            connectionData.passphrase = passphrase;
        }
    }
    
    connectToServer(connectionData);
});

// Disconnect button
disconnectBtn.addEventListener('click', () => {
    if (socket) {
        socket.close();
    }
    disconnect();
});

// Connect to SSH server
function connectToServer(connectionData) {
    try {
        updateStatus('Connecting...', 'connecting');
        connectBtn.disabled = true;
        
        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        socket = new WebSocket(`${protocol}//${window.location.host}`);
        
        // Set binary type to arraybuffer for proper handling
        socket.binaryType = 'arraybuffer';
        
        const connectionTimeout = setTimeout(() => {
            if (socket && socket.readyState === WebSocket.CONNECTING) {
                socket.close();
                updateStatus('Connection timeout. Please check the server.', 'error');
                connectBtn.disabled = false;
            }
        }, 15000); // 15 second timeout
        
        socket.onopen = () => {
            clearTimeout(connectionTimeout);
            console.log('WebSocket connection opened');
            // Send connection data
            socket.send(JSON.stringify(connectionData));
        };
        
        socket.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                const message = JSON.parse(event.data);
                
                switch (message.type) {
                    case 'connected':
                        isConnected = true;
                        onConnected(connectionData);
                        break;
                    case 'disconnected':
                        isConnected = false;
                        disconnect();
                        break;
                    case 'error':
                        updateStatus(message.message, 'error');
                        term.writeln(`\x1b[31mError: ${message.message}\x1b[0m`);
                        console.error('Server error:', message.message);
                        break;
                }
            } else {
                // Binary data (terminal output) - properly handle ArrayBuffer
                if (isConnected) {
                    try {
                        let text = '';
                        if (event.data instanceof ArrayBuffer) {
                            // Handle ArrayBuffer
                            text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(event.data));
                        } else if (event.data instanceof Blob) {
                            // Handle Blob by converting to ArrayBuffer first
                            const arrayBuffer = await event.data.arrayBuffer();
                            text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(arrayBuffer));
                        } else {
                            // Handle other types
                            text = new TextDecoder('utf-8', { fatal: false }).decode(
                                event.data instanceof Uint8Array ? event.data : new Uint8Array(event.data)
                            );
                        }
                        
                        if (text && text.length > 0) {
                            term.write(text);
                        }
                    } catch (e) {
                        console.error('Error decoding terminal data:', e);
                        // Fallback: try to convert to string
                        if (event.data) {
                            term.write(event.data.toString());
                        }
                    }
                }
            }
        };
        
        socket.onerror = (error) => {
            clearTimeout(connectionTimeout);
            console.error('WebSocket error:', error);
            updateStatus('Connection error. Check console for details.', 'error');
            connectBtn.disabled = false;
        };
        
        socket.onclose = () => {
            clearTimeout(connectionTimeout);
            console.log('WebSocket connection closed');
            if (isConnected) {
                updateStatus('Connection closed', 'disconnected');
            }
            isConnected = false;
            // Don't automatically disconnect here to allow for reconnection
        };
        
    } catch (error) {
        updateStatus(`Connection failed: ${error.message}`, 'error');
        connectBtn.disabled = false;
    }
}

// Handle successful connection
function onConnected(connectionData) {
    updateStatus('Connected', 'connected');
    
    // Show terminal panel
    connectionPanel.classList.add('hidden');
    terminalContainer.classList.remove('hidden');
    
    // Update connection info
    connectionInfo.textContent = `${connectionData.username}@${connectionData.host}:${connectionData.port}`;
    
    // Focus terminal
    term.focus();
    
    // Display welcome message
    term.writeln('\x1b[32mConnected to SSH server!\x1b[0m');
    term.writeln('\x1b[36mType your commands below:\x1b[0m');
    term.writeln('');
    
    // Initial terminal resize
    setTimeout(() => {
        fitAddon.fit();
        const dimensions = fitAddon.proposeDimensions();
        if (dimensions && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'resize',
                cols: dimensions.cols,
                rows: dimensions.rows,
                width: dimensions.width,
                height: dimensions.height
            }));
        }
    }, 100);
}

// Disconnect from server
function disconnect() {
    isConnected = false;
    
    if (socket) {
        socket.close();
        socket = null;
    }
    
    updateStatus('Disconnected', 'disconnected');
    connectBtn.disabled = false;
    
    // Show connection panel
    connectionPanel.classList.remove('hidden');
    terminalContainer.classList.add('hidden');
    
    // Clear terminal
    term.clear();
    
    // Display disconnect message
    term.writeln('\x1b[33mDisconnected from SSH server.\x1b[0m');
}

// Update status bar
function updateStatus(message, type = '') {
    statusElement.textContent = message;
    statusElement.className = '';
    
    switch (type) {
        case 'connected':
            statusElement.classList.add('status-connected');
            break;
        case 'disconnected':
            statusElement.classList.add('status-disconnected');
            break;
        case 'connecting':
            statusElement.classList.add('status-connecting');
            break;
        case 'error':
            statusElement.classList.add('status-error');
            break;
        default:
            statusElement.classList.add('status-disconnected');
    }
}

// Initialize
updateStatus('Ready to connect', 'disconnected');

// This file is now deprecated. All functionality has been moved to dashboard.js
// Keeping this file for backward compatibility, but it's no longer used in the new multi-session interface.
console.log('WebSSH client loaded. Using dashboard.js for multi-session functionality.');
