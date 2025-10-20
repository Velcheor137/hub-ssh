// Dashboard functionality
class HubSSHDashboard {
    constructor() {
        this.sessions = [];
        this.groups = [];
        this.currentSession = null;
        this.theme = localStorage.getItem('hub-ssh-theme') || 'dark';
        this.viewMode = localStorage.getItem('hub-ssh-view-mode') || 'grid';
        this.draggedSession = null;
        this.sftpPanelVisible = false;
        this.currentSftpPath = '~'; // Start in home directory
        this.selectedFiles = new Set();
        
        // Initialize settings
        this.settings = {
            fontSize: 14,
            fontFamily: 'Fira Code, Consolas, monospace',
            terminalColors: {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#64ffda',
                selection: '#64ffda40'
            },
            behavior: {
                'auto-connect': false,
                'confirm-disconnect': true,
                'show-timestamps': false,
                'terminal-bell': true
            },
            advanced: {
                'connection-timeout': 15,
                'keepalive-interval': 15,
                'terminal-scrollback': 1000
            }
        };
        
        this.init();
    }

    init() {
        // Apply theme
        this.applyTheme();
        
        // Load data
        this.loadGroups();
        this.loadSessions();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    applyTheme() {
        if (this.theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        // Save theme preference
        localStorage.setItem('hub-ssh-theme', this.theme);
    }

    setupEventListeners() {
        // Dashboard buttons
        document.getElementById('add-session-btn').addEventListener('click', () => {
            this.openSessionModal();
        });
        
        document.getElementById('add-group-btn').addEventListener('click', () => {
            this.showModal('add-group-modal');
        });
        
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showView('settings-view');
        });
        
        document.getElementById('sort-sessions-btn').addEventListener('click', () => {
            this.sortSessions();
        });
        
        document.getElementById('toggle-view-btn').addEventListener('click', () => {
            this.toggleViewMode();
        });
        
        // Session form
        document.getElementById('session-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSession();
        });
        
        // Group form
        document.getElementById('group-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveGroup();
        });
        
        // Auth method toggle
        document.getElementById('auth-method').addEventListener('change', (e) => {
            this.toggleAuthMethod(e.target.value);
        });
        
        // Modal close buttons
        document.querySelectorAll('.close-modal, .close-modal-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.hideModal('add-session-modal');
                this.hideModal('add-group-modal');
            });
        });
        
        // Back buttons
        document.getElementById('back-to-dashboard').addEventListener('click', () => {
            this.showView('dashboard');
        });
        
        document.getElementById('back-to-dashboard-settings').addEventListener('click', () => {
            this.showView('dashboard');
        });
        
        // Disconnect button
        document.getElementById('disconnect-session-btn').addEventListener('click', () => {
            if (this.currentSession) {
                this.currentSession.disconnect();
                this.currentSession = null;
            }
        });
        
        // SFTP button
        document.getElementById('sftp-btn').addEventListener('click', () => {
            if (this.currentSession) {
                this.toggleSftpPanel();
            }
        });
        
        // Edit session button
        document.getElementById('edit-session-btn').addEventListener('click', () => {
            if (this.currentSession && this.currentSession.session) {
                const session = this.sessions.find(s => s.id === this.currentSession.session.sessionId);
                if (session) {
                    this.openSessionModal(session);
                }
            }
        });
        
        // SFTP actions
        document.getElementById('sftp-upload-btn').addEventListener('click', () => {
            document.getElementById('sftp-file-input').click();
        });
        
        document.getElementById('sftp-file-input').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
            // Reset the input to allow uploading the same file again
            e.target.value = '';
        });
        
        document.getElementById('sftp-download-btn').addEventListener('click', () => {
            this.downloadSelectedFiles();
        });
        
        document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });
        
        // Theme selector
        document.getElementById('theme-selector').addEventListener('change', (e) => {
            this.theme = e.target.value;
            this.applyTheme();
        });
        
        // Set initial theme selector value
        document.getElementById('theme-selector').value = this.theme;
        
        // Enhanced settings event listeners
        this.setupEnhancedSettings();
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const sessionModal = document.getElementById('add-session-modal');
            const groupModal = document.getElementById('add-group-modal');
            if (e.target === sessionModal) {
                this.hideModal('add-session-modal');
            }
            if (e.target === groupModal) {
                this.hideModal('add-group-modal');
            }
        });
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    showView(viewId) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden');
        });
        
        // Show requested view
        document.getElementById(viewId).classList.remove('hidden');
    }

    toggleAuthMethod(method) {
        const passwordAuth = document.getElementById('password-auth');
        const keyAuth = document.getElementById('key-auth');
        
        if (method === 'password') {
            passwordAuth.classList.remove('hidden');
            keyAuth.classList.add('hidden');
        } else {
            passwordAuth.classList.add('hidden');
            keyAuth.classList.remove('hidden');
        }
    }

    setupEnhancedSettings() {
        // Load saved settings
        this.loadSettings();
        
        // Font size slider
        const fontSizeSlider = document.getElementById('font-size');
        const fontSizeValue = document.getElementById('font-size-value');
        fontSizeSlider.addEventListener('input', (e) => {
            const size = e.target.value;
            fontSizeValue.textContent = size + 'px';
            this.settings.fontSize = parseInt(size);
            this.saveSettings();
            this.applyTerminalSettings();
        });
        
        // Font family selector
        document.getElementById('font-family').addEventListener('change', (e) => {
            this.settings.fontFamily = e.target.value;
            this.saveSettings();
            this.applyTerminalSettings();
        });
        
        // Color settings
        this.setupColorSettings();
        
        // Behavior settings
        this.setupBehaviorSettings();
        
        // Advanced settings
        this.setupAdvancedSettings();
        
        // Color preset and reset buttons
        document.getElementById('reset-colors-btn').addEventListener('click', () => {
            this.resetColorsToDefault();
        });
        
        document.getElementById('preset-colors-btn').addEventListener('click', () => {
            this.showColorPresets();
        });
    }

    setupColorSettings() {
        const colorInputs = [
            'background-color', 'foreground-color', 'cursor-color', 'selection-color'
        ];
        
        colorInputs.forEach(inputId => {
            const colorInput = document.getElementById(inputId);
            const textInput = document.getElementById(inputId + '-text');
            
            // Color picker to text input sync
            colorInput.addEventListener('change', (e) => {
                textInput.value = e.target.value;
                this.settings.terminalColors[inputId.replace('-color', '')] = e.target.value;
                this.saveSettings();
                this.applyTerminalSettings();
            });
            
            // Text input to color picker sync
            textInput.addEventListener('input', (e) => {
                const color = e.target.value;
                if (this.isValidColor(color)) {
                    colorInput.value = color;
                    this.settings.terminalColors[inputId.replace('-color', '')] = color;
                    this.saveSettings();
                    this.applyTerminalSettings();
                }
            });
        });
    }

    setupBehaviorSettings() {
        const behaviorSettings = [
            'auto-connect', 'confirm-disconnect', 'show-timestamps', 'terminal-bell'
        ];
        
        behaviorSettings.forEach(settingId => {
            const element = document.getElementById(settingId);
            element.addEventListener('change', (e) => {
                this.settings.behavior[settingId] = e.target.checked;
                this.saveSettings();
            });
        });
    }

    setupAdvancedSettings() {
        const advancedSettings = [
            'connection-timeout', 'keepalive-interval', 'terminal-scrollback'
        ];
        
        advancedSettings.forEach(settingId => {
            const element = document.getElementById(settingId);
            element.addEventListener('change', (e) => {
                this.settings.advanced[settingId] = parseInt(e.target.value);
                this.saveSettings();
            });
        });
    }

    // Group management
    async loadGroups() {
        try {
            const response = await fetch('/api/groups');
            if (response.ok) {
                this.groups = await response.json();
            } else {
                // If groups endpoint doesn't exist, initialize empty groups
                this.groups = [];
            }
        } catch (error) {
            // If there's an error, initialize empty groups
            this.groups = [];
        }
    }

    async saveGroup() {
        const groupName = document.getElementById('group-name').value.trim();
        if (!groupName) return;

        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: groupName })
            });
            
            if (response.ok) {
                this.hideModal('add-group-modal');
                document.getElementById('group-name').value = '';
                this.loadGroups();
                this.renderSessions();
            } else {
                console.error('Failed to save group');
            }
        } catch (error) {
            console.error('Error saving group:', error);
        }
    }

    async deleteGroup(groupId) {
        if (!confirm('Are you sure you want to delete this group? All sessions in this group will be moved to ungrouped.')) {
            return;
        }

        try {
            const response = await fetch(`/api/groups/${groupId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.loadGroups();
                this.loadSessions(); // Reload sessions to update group assignments
            } else {
                console.error('Failed to delete group');
            }
        } catch (error) {
            console.error('Error deleting group:', error);
        }
    }

    // Session management
    async loadSessions() {
        try {
            const response = await fetch('/api/sessions');
            if (response.ok) {
                this.sessions = await response.json();
                this.renderSessions();
            } else {
                console.error('Failed to load sessions');
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
        }
    }

    renderSessions() {
        const container = document.getElementById('sessions-container');
        
        if (this.sessions.length === 0 && this.groups.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No sessions yet. Add your first SSH connection!</p></div>';
            return;
        }
        
        // Sort sessions by name
        this.sessions.sort((a, b) => a.name.localeCompare(b.name));
        
        // Group sessions by group ID
        const groupedSessions = {};
        const ungroupedSessions = [];
        
        // Initialize grouped sessions object with groups
        this.groups.forEach(group => {
            groupedSessions[group.id] = {
                group: group,
                sessions: []
            };
        });
        
        // Assign sessions to groups
        this.sessions.forEach(session => {
            if (session.groupId && groupedSessions[session.groupId]) {
                groupedSessions[session.groupId].sessions.push(session);
            } else {
                ungroupedSessions.push(session);
            }
        });
        
        // Render
        let html = '';
        
        // Render groups with sessions
        Object.values(groupedSessions).forEach(groupData => {
            if (groupData.sessions.length > 0) {
                html += this.renderGroup(groupData.group, groupData.sessions);
            }
        });
        
        // Render ungrouped sessions
        if (ungroupedSessions.length > 0) {
            html += this.renderGroup(null, ungroupedSessions);
        }
        
        container.innerHTML = html;
        
        // Add event listeners for session cards
        this.addSessionEventListeners();
    }

    renderGroup(group, sessions) {
        const groupId = group ? group.id : 'ungrouped';
        const groupName = group ? group.name : 'Ungrouped';
        
        let html = `
            <div class="group-container" data-group-id="${groupId}">
                <div class="group-header" data-group-id="${groupId}">
                    <h3>${groupName}</h3>
                    ${group ? `
                        <div class="group-actions">
                            <button class="delete-group-btn" data-group-id="${group.id}">🗑️</button>
                        </div>
                    ` : ''}
                </div>
                <div class="group-content" data-group-id="${groupId}">
        `;
        
        if (this.viewMode === 'list') {
            html += '<div class="sessions-list">';
        } else {
            html += '<div class="sessions-grid">';
        }
        
        sessions.forEach(session => {
            html += this.renderSessionCard(session);
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }

    renderSessionCard(session) {
        return `
            <div class="session-card" data-session-id="${session.id}" draggable="true">
                <h3>
                    ${session.name}
                    <div class="session-card-actions">
                        <button class="edit-session-btn" data-session-id="${session.id}">✏️</button>
                        <button class="delete-session-btn" data-session-id="${session.id}">🗑️</button>
                    </div>
                </h3>
                <p class="host">${session.host}:${session.port}</p>
                <p class="username">${session.username}</p>
                <p>Created: ${new Date(session.createdAt).toLocaleDateString()}</p>
            </div>
        `;
    }

    addSessionEventListeners() {
        // Session card click events
        document.querySelectorAll('.session-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on action buttons
                if (e.target.closest('.session-card-actions')) return;
                
                const sessionId = card.dataset.sessionId;
                const session = this.sessions.find(s => s.id === parseInt(sessionId));
                if (session) {
                    this.connectToSession(session);
                }
            });
        });
        
        // Edit session buttons
        document.querySelectorAll('.edit-session-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const sessionId = button.dataset.sessionId;
                const session = this.sessions.find(s => s.id === parseInt(sessionId));
                if (session) {
                    this.openSessionModal(session);
                }
            });
        });
        
        // Delete session buttons
        document.querySelectorAll('.delete-session-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const sessionId = button.dataset.sessionId;
                this.deleteSession(sessionId);
            });
        });
        
        // Delete group buttons
        document.querySelectorAll('.delete-group-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupId = button.dataset.groupId;
                this.deleteGroup(groupId);
            });
        });
        
        // Drag and drop functionality
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const sessionCards = document.querySelectorAll('.session-card[draggable="true"]');
        const groupHeaders = document.querySelectorAll('.group-header');
        const groupContents = document.querySelectorAll('.group-content');
        
        // Session drag events
        sessionCards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this.draggedSession = card.dataset.sessionId;
                card.classList.add('dragging');
                
                // Add visual feedback to group headers
                groupHeaders.forEach(header => {
                    header.classList.add('drop-target');
                });
            });
            
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.draggedSession = null;
                
                // Remove visual feedback from group headers
                groupHeaders.forEach(header => {
                    header.classList.remove('drop-target');
                });
                
                // Remove any drop zones
                document.querySelectorAll('.drop-zone').forEach(zone => zone.remove());
            });
        });
        
        // Group header drop events
        groupHeaders.forEach(header => {
            header.addEventListener('dragover', (e) => {
                e.preventDefault();
                header.classList.add('drag-over');
            });
            
            header.addEventListener('dragleave', () => {
                header.classList.remove('drag-over');
            });
            
            header.addEventListener('drop', (e) => {
                e.preventDefault();
                header.classList.remove('drag-over', 'drop-target');
                
                if (this.draggedSession) {
                    const groupId = header.dataset.groupId;
                    this.moveSessionToGroup(this.draggedSession, groupId === 'ungrouped' ? null : groupId);
                }
            });
        });
        
        // Group content drop events (for visual drop zones)
        groupContents.forEach(content => {
            content.addEventListener('dragover', (e) => {
                e.preventDefault();
                
                // Remove existing drop zones
                document.querySelectorAll('.drop-zone').forEach(zone => zone.remove());
                
                // Create drop zone if not already in group
                const groupId = content.dataset.groupId;
                const session = this.sessions.find(s => s.id === parseInt(this.draggedSession));
                
                if (session && session.groupId != groupId) {
                    const dropZone = document.createElement('div');
                    dropZone.className = 'drop-zone';
                    dropZone.innerHTML = '<p>Drop here to move session to this group</p>';
                    content.appendChild(dropZone);
                }
            });
            
            content.addEventListener('dragleave', (e) => {
                if (e.target === content) {
                    document.querySelectorAll('.drop-zone').forEach(zone => zone.remove());
                }
            });
            
            content.addEventListener('drop', (e) => {
                e.preventDefault();
                document.querySelectorAll('.drop-zone').forEach(zone => zone.remove());
                
                if (this.draggedSession) {
                    const groupId = content.dataset.groupId;
                    this.moveSessionToGroup(this.draggedSession, groupId === 'ungrouped' ? null : groupId);
                }
            });
        });
    }

    async moveSessionToGroup(sessionId, groupId) {
        try {
            const response = await fetch(`/api/sessions/${sessionId}/move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupId: groupId })
            });
            
            if (response.ok) {
                this.loadSessions(); // Reload to reflect changes
            } else {
                console.error('Failed to move session');
            }
        } catch (error) {
            console.error('Error moving session:', error);
        }
    }

    openSessionModal(session = null) {
        const form = document.getElementById('session-form');
        const title = document.getElementById('session-modal-title');
        
        // Reset form
        form.reset();
        document.getElementById('session-id').value = '';
        document.getElementById('password-auth').classList.remove('hidden');
        document.getElementById('key-auth').classList.add('hidden');
        document.getElementById('auth-method').value = 'password';
        
        // Populate groups dropdown
        this.populateGroupsDropdown();
        
        if (session) {
            // Edit mode
            title.textContent = 'Edit SSH Session';
            document.getElementById('session-id').value = session.id;
            document.getElementById('session-name').value = session.name;
            document.getElementById('session-group').value = session.groupId || '';
            document.getElementById('host').value = session.host;
            document.getElementById('port').value = session.port;
            document.getElementById('username').value = session.username;
            document.getElementById('auth-method').value = session.auth;
            
            if (session.auth === 'privateKey') {
                document.getElementById('password-auth').classList.add('hidden');
                document.getElementById('key-auth').classList.remove('hidden');
                document.getElementById('private-key').value = session.privateKey || '';
            } else {
                document.getElementById('password-auth').classList.remove('hidden');
                document.getElementById('key-auth').classList.add('hidden');
                document.getElementById('password').value = session.password || '';
            }
        } else {
            // Add mode
            title.textContent = 'Add New SSH Session';
            document.getElementById('session-group').value = '';
        }
        
        this.showModal('add-session-modal');
    }

    populateGroupsDropdown() {
        const groupSelect = document.getElementById('session-group');
        groupSelect.innerHTML = '<option value="">None</option>';
        
        this.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });
    }

    connectToSession(session) {
        // If there's already a session, disconnect it first
        if (this.currentSession) {
            this.currentSession.disconnect();
            this.currentSession = null;
        }
        
        // Initialize terminal session with session ID
        const connectData = {
            sessionId: session.id,
            name: session.name
        };
        
        // Initialize terminal session
        this.currentSession = new HubSSHTerminal(connectData);
        this.currentSession.connect();
        
        // Update UI
        document.getElementById('session-title').textContent = connectData.name;
        this.showView('session-view');
        
        // Hide SFTP panel by default
        this.sftpPanelVisible = false;
        document.getElementById('sftp-panel').classList.add('hidden');
        this.selectedFiles.clear();
        this.updateDownloadButtonState();
    }

    async saveSession() {
        const sessionId = document.getElementById('session-id').value;
        const sessionData = {
            name: document.getElementById('session-name').value || `Session ${Date.now()}`,
            groupId: document.getElementById('session-group').value || null,
            host: document.getElementById('host').value,
            port: document.getElementById('port').value,
            username: document.getElementById('username').value,
            auth: document.getElementById('auth-method').value,
            password: document.getElementById('password').value,
            privateKey: document.getElementById('private-key').value,
            passphrase: document.getElementById('passphrase').value
        };
        
        try {
            const method = sessionId ? 'PUT' : 'POST';
            const url = sessionId ? `/api/sessions/${sessionId}` : '/api/sessions';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });
            
            if (response.ok) {
                this.hideModal('add-session-modal');
                // Reset form
                document.getElementById('session-form').reset();
                // Reload sessions
                this.loadSessions();
                
                // If this was a new session and user wants to connect immediately
                if (!sessionId) {
                    if (confirm('Session saved successfully. Connect now?')) {
                        const result = await response.json();
                        // Get full session data for immediate connection
                        const fullSession = {
                            id: result.id,
                            name: sessionData.name,
                            host: sessionData.host,
                            port: sessionData.port,
                            username: sessionData.username
                        };
                        this.connectToSession(fullSession);
                    }
                }
            } else {
                console.error('Failed to save session');
            }
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }

    async deleteSession(sessionId) {
        if (!confirm('Are you sure you want to delete this session?')) {
            return;
        }

        try {
            const response = await fetch(`/api/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.loadSessions();
            } else {
                console.error('Failed to delete session');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    }

    sortSessions() {
        // Sessions are automatically sorted by name in renderSessions()
        this.renderSessions();
    }

    toggleViewMode() {
        this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
        localStorage.setItem('hub-ssh-view-mode', this.viewMode);
        
        const toggleBtn = document.getElementById('toggle-view-btn');
        toggleBtn.textContent = this.viewMode === 'grid' ? 'List View' : 'Grid View';
        
        this.renderSessions();
    }

    // SFTP Methods
    toggleSftpPanel() {
        this.sftpPanelVisible = !this.sftpPanelVisible;
        const sftpPanel = document.getElementById('sftp-panel');
        
        if (this.sftpPanelVisible) {
            sftpPanel.classList.remove('hidden');
            // Initialize SFTP if not already done
            if (this.currentSession && !this.currentSession.sftpInitialized) {
                this.currentSession.initSftp((err) => {
                    if (err) {
                        console.error('SFTP initialization error:', err);
                        this.showSftpError('Failed to initialize SFTP: ' + err.message);
                        return;
                    }
                    // Start in home directory
                    this.currentSftpPath = '~';
                    this.listDirectory(this.currentSftpPath);
                });
            } else if (this.currentSession && this.currentSession.sftpInitialized) {
                // Refresh current directory
                this.listDirectory(this.currentSftpPath);
            } else {
                // No current session
                this.showSftpError('No active SSH session');
            }
        } else {
            sftpPanel.classList.add('hidden');
        }
    }

    showSftpError(message) {
        // Create an error element if it doesn't exist
        let errorElement = document.getElementById('sftp-error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'sftp-error-message';
            errorElement.className = 'sftp-error-message';
            const sftpPanel = document.getElementById('sftp-panel');
            sftpPanel.insertBefore(errorElement, sftpPanel.firstChild);
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }

    listDirectory(path) {
        if (this.currentSession) {
            // Normalize path for SFTP operations
            let normalizedPath;
            if (path === '~') {
                normalizedPath = '.';
            } else if (path === '/') {
                normalizedPath = '/';
            } else {
                normalizedPath = path;
            }
            
            this.currentSession.listDirectory(normalizedPath, (err, files) => {
                if (err) {
                    console.error('Error listing directory:', err);
                    this.showSftpError('Error listing directory: ' + err.message);
                    // Try fallback to home directory
                    if (path !== '~') {
                        this.currentSftpPath = '~';
                        this.listDirectory('~');
                    }
                    return;
                }
                this.renderFileList(files, path);
            });
        }
    }

    renderFileList(files, path) {
        this.currentSftpPath = path;
        const fileListElement = document.getElementById('sftp-file-list');
        const breadcrumbElement = document.getElementById('sftp-breadcrumb');
        
        // Update breadcrumb
        this.updateBreadcrumb(path);
        
        // Clear current file list
        fileListElement.innerHTML = '';
        
        // Add parent directory entry if we're not at the root
        // Allow navigation above home directory if possible
        if (path !== '/') {
            const parentItem = document.createElement('div');
            parentItem.className = 'sftp-file-item directory';
            parentItem.innerHTML = `
                <div class="sftp-checkbox"></div>
                <div class="sftp-file-name">📁 ..</div>
                <div class="sftp-file-size"></div>
                <div class="sftp-file-modified"></div>
            `;
            parentItem.addEventListener('click', () => {
                // Go to parent directory
                let parentPath;
                
                if (path === '~') {
                    // Try to go to the parent of home directory (usually /home/username -> /home)
                    // For now, we'll go to the root directory
                    parentPath = '/';
                } else if (path === '/') {
                    // Already at root, can't go up
                    return;
                } else {
                    // Split path and remove last segment
                    const parts = path.split('/').filter(part => part);
                    if (parts.length === 0) {
                        parentPath = '/';
                    } else if (parts.length === 1) {
                        // If we're at a top-level directory like /home, go to root
                        parentPath = '/';
                    } else {
                        // Remove the last part and reconstruct the path
                        parentPath = '/' + parts.slice(0, -1).join('/');
                    }
                }
                this.listDirectory(parentPath);
            });
            fileListElement.appendChild(parentItem);
        }
        
        // Sort files: directories first, then alphabetically
        files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.filename.localeCompare(b.filename);
        });
        
        // Add files and directories
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = `sftp-file-item ${file.isDirectory ? 'directory' : 'file'}`;
            fileItem.dataset.filename = file.filename;
            
            const icon = file.isDirectory ? '📁' : '📄';
            const size = file.isDirectory ? '' : this.formatFileSize(file.size);
            const modified = new Date(file.attrs.mtime * 1000).toLocaleString();
            
            fileItem.innerHTML = `
                <div class="sftp-checkbox">
                    <input type="checkbox" class="file-checkbox" data-filename="${file.filename}">
                </div>
                <div class="sftp-file-name">${icon} ${file.filename}</div>
                <div class="sftp-file-size">${size}</div>
                <div class="sftp-file-modified">${modified}</div>
            `;
            
            // Add click event for directories
            if (file.isDirectory) {
                fileItem.addEventListener('click', (e) => {
                    // If clicking on checkbox, don't navigate
                    if (e.target.classList.contains('file-checkbox')) return;
                    
                    // Navigate to the directory
                    let newPath;
                    if (this.currentSftpPath === '~') {
                        // If we're at home directory, construct path without leading slash
                        newPath = file.filename;
                    } else if (this.currentSftpPath === '/') {
                        // If we're at root, construct path with leading slash
                        newPath = `/${file.filename}`;
                    } else {
                        // For other paths, append with slash
                        newPath = `${this.currentSftpPath}/${file.filename}`;
                    }
                    this.listDirectory(newPath);
                });
            } else {
                // Add click event for files to download
                fileItem.addEventListener('click', (e) => {
                    // If clicking on checkbox, don't download
                    if (e.target.classList.contains('file-checkbox')) return;
                    
                    // Download the file directly
                    this.downloadFile(file.filename);
                });
            }
            
            // Add checkbox event
            const checkbox = fileItem.querySelector('.file-checkbox');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedFiles.add(file.filename);
                } else {
                    this.selectedFiles.delete(file.filename);
                }
                this.updateDownloadButtonState();
            });
            
            fileListElement.appendChild(fileItem);
        });
        
        // Update select all checkbox
        this.updateSelectAllCheckbox();
    }

    updateBreadcrumb(path) {
        const breadcrumbElement = document.getElementById('sftp-breadcrumb');
        breadcrumbElement.innerHTML = '';
        
        // Split path and create breadcrumb
        let parts;
        if (path === '~') {
            parts = [];
        } else if (path === '/') {
            parts = [];
        } else {
            // Remove leading slash and split
            parts = path.replace(/^\/+/, '').split('/').filter(part => part);
        }
        
        // Add root link
        const rootLink = document.createElement('a');
        rootLink.textContent = '/';
        rootLink.addEventListener('click', () => {
            this.listDirectory('/');
        });
        breadcrumbElement.appendChild(rootLink);
        
        // Add home link if we're not at home
        if (path !== '~') {
            const separator = document.createElement('span');
            separator.className = 'separator';
            separator.textContent = ' / ';
            breadcrumbElement.appendChild(separator);
            
            const homeLink = document.createElement('a');
            homeLink.textContent = '~';
            homeLink.addEventListener('click', () => {
                this.listDirectory('~');
            });
            breadcrumbElement.appendChild(homeLink);
        }
        
        // Add each part
        let currentPath = '';
        parts.forEach((part, index) => {
            const separator = document.createElement('span');
            separator.className = 'separator';
            separator.textContent = ' / ';
            breadcrumbElement.appendChild(separator);
            
            currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
            const link = document.createElement('a');
            link.textContent = part;
            link.addEventListener('click', () => {
                this.listDirectory(currentPath);
            });
            breadcrumbElement.appendChild(link);
        });
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        const allCheckboxes = document.querySelectorAll('.file-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.file-checkbox:checked');
        
        if (allCheckboxes.length > 0 && checkedCheckboxes.length === allCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes.length > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    }

    toggleSelectAll(select) {
        this.selectedFiles.clear();
        document.querySelectorAll('.file-checkbox').forEach(checkbox => {
            checkbox.checked = select;
            if (select) {
                this.selectedFiles.add(checkbox.dataset.filename);
            }
        });
        this.updateDownloadButtonState();
    }

    updateDownloadButtonState() {
        const downloadBtn = document.getElementById('sftp-download-btn');
        downloadBtn.disabled = this.selectedFiles.size === 0;
    }

    handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        if (this.currentSession && this.currentSession.sftpInitialized) {
            // Upload each selected file
            Array.from(files).forEach(file => {
                this.currentSession.uploadFile(file, this.currentSftpPath, (err) => {
                    if (err) {
                        console.error('Error uploading file:', err);
                        alert('Error uploading file ' + file.name + ': ' + err.message);
                    } else {
                        // Refresh the file list after successful upload
                        this.listDirectory(this.currentSftpPath);
                    }
                });
            });
        } else {
            alert('SFTP not initialized. Please make sure you are connected to an SFTP session.');
        }
    }

    downloadSelectedFiles() {
        if (this.selectedFiles.size === 0) return;
        
        // Download each selected file individually
        const files = Array.from(this.selectedFiles);
        files.forEach(filename => {
            this.downloadFile(filename);
        });
    }

    downloadFile(filepath, filename, callback) {
        if (!this.sftpInitialized) {
            const error = new Error('SFTP not initialized');
            console.error('SFTP not initialized');
            // If no callback provided, handle the error directly
            if (callback) {
                callback(error);
            }
            return;
        }
        
        // Generate a unique ID for this download
        const fileId = `${filepath}_${Date.now()}`;
        this.downloadCallbacks.set(fileId, callback);
        
        // Request file download
        this.socket.send(JSON.stringify({ 
            type: 'sftp_download_file', 
            filepath: filepath,
            fileId: fileId
        }));
    }

    uploadFile(file, remotePath, callback) {
        if (!this.sftpInitialized) {
            console.error('SFTP not initialized');
            callback(new Error('SFTP not initialized'));
            return;
        }
        
        // Generate a unique ID for this upload
        const fileId = `${file.name}_${Date.now()}`;
        
        // Read the file as ArrayBuffer
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            
            // Send upload request with file data
            this.socket.send(JSON.stringify({ 
                type: 'sftp_upload_file',
                filename: file.name,
                filepath: remotePath === '~' ? file.name : `${remotePath}/${file.name}`,
                fileId: fileId,
                data: Array.from(new Uint8Array(arrayBuffer)),
                size: file.size
            }));
            
            // Set up callback for upload response
            this.uploadCallbacks.set(fileId, callback);
        };
        
        reader.onerror = (e) => {
            callback(new Error('Failed to read file: ' + e.target.error.message));
        };
        
        reader.readAsArrayBuffer(file);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Settings management methods
    loadSettings() {
        const saved = localStorage.getItem('hub-ssh-settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
            } catch (e) {
                console.error('Failed to parse saved settings:', e);
            }
        }
        
        // Apply settings to UI
        this.applySettingsToUI();
    }

    saveSettings() {
        localStorage.setItem('hub-ssh-settings', JSON.stringify(this.settings));
    }

    applySettingsToUI() {
        // Font size
        const fontSizeSlider = document.getElementById('font-size');
        const fontSizeValue = document.getElementById('font-size-value');
        if (fontSizeSlider && fontSizeValue) {
            fontSizeSlider.value = this.settings.fontSize;
            fontSizeValue.textContent = this.settings.fontSize + 'px';
        }

        // Font family
        const fontFamilySelect = document.getElementById('font-family');
        if (fontFamilySelect) {
            fontFamilySelect.value = this.settings.fontFamily;
        }

        // Colors
        const colorInputs = ['background-color', 'foreground-color', 'cursor-color', 'selection-color'];
        colorInputs.forEach(inputId => {
            const colorInput = document.getElementById(inputId);
            const textInput = document.getElementById(inputId + '-text');
            const colorKey = inputId.replace('-color', '');
            if (colorInput && textInput && this.settings.terminalColors[colorKey]) {
                colorInput.value = this.settings.terminalColors[colorKey];
                textInput.value = this.settings.terminalColors[colorKey];
            }
        });

        // Behavior settings
        Object.keys(this.settings.behavior).forEach(settingId => {
            const element = document.getElementById(settingId);
            if (element) {
                element.checked = this.settings.behavior[settingId];
            }
        });

        // Advanced settings
        Object.keys(this.settings.advanced).forEach(settingId => {
            const element = document.getElementById(settingId);
            if (element) {
                element.value = this.settings.advanced[settingId];
            }
        });
    }

    applyTerminalSettings() {
        if (this.currentSession && this.currentSession.term) {
            // Apply font settings
            this.currentSession.term.options.fontSize = this.settings.fontSize;
            this.currentSession.term.options.fontFamily = this.settings.fontFamily;
            
            // Apply color theme
            this.currentSession.term.options.theme = {
                background: this.settings.terminalColors.background,
                foreground: this.settings.terminalColors.foreground,
                cursor: this.settings.terminalColors.cursor,
                selection: this.settings.terminalColors.selection
            };
            
            // Refresh terminal
            this.currentSession.term.refresh(0, this.currentSession.term.rows - 1);
        }
    }

    isValidColor(color) {
        const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}|[A-Fa-f0-9]{8})$/;
        const rgbPattern = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
        const rgbaPattern = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/;
        return hexPattern.test(color) || rgbPattern.test(color) || rgbaPattern.test(color);
    }

    resetColorsToDefault() {
        this.settings.terminalColors = {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#64ffda',
            selection: '#64ffda40'
        };
        this.saveSettings();
        this.applySettingsToUI();
        this.applyTerminalSettings();
    }

    showColorPresets() {
        const presets = [
            {
                name: 'Default Dark',
                description: 'Classic dark theme',
                colors: {
                    background: '#1e1e1e',
                    foreground: '#d4d4d4',
                    cursor: '#64ffda',
                    selection: '#64ffda40'
                }
            },
            {
                name: 'Solarized Dark',
                description: 'Popular dark theme',
                colors: {
                    background: '#002b36',
                    foreground: '#839496',
                    cursor: '#93a1a1',
                    selection: '#073642'
                }
            },
            {
                name: 'Monokai',
                description: 'Sublime Text inspired',
                colors: {
                    background: '#272822',
                    foreground: '#f8f8f2',
                    cursor: '#f8f8f0',
                    selection: '#49483e'
                }
            },
            {
                name: 'Dracula',
                description: 'Modern dark theme',
                colors: {
                    background: '#282a36',
                    foreground: '#f8f8f2',
                    cursor: '#50fa7b',
                    selection: '#44475a'
                }
            },
            {
                name: 'Light Theme',
                description: 'Clean light theme',
                colors: {
                    background: '#f5f5f5',
                    foreground: '#333333',
                    cursor: '#64ffda',
                    selection: '#64ffda40'
                }
            }
        ];

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'color-preset-modal';
        modal.innerHTML = `
            <div class="color-preset-content">
                <h3>Color Presets</h3>
                <div class="color-preset-grid">
                    ${presets.map(preset => `
                        <div class="color-preset-item" data-preset='${JSON.stringify(preset)}'>
                            <div class="color-preset-name">${preset.name}</div>
                            <div class="color-preset-preview">
                                <div class="color-preset-color" style="background-color: ${preset.colors.background}"></div>
                                <div class="color-preset-color" style="background-color: ${preset.colors.foreground}"></div>
                                <div class="color-preset-color" style="background-color: ${preset.colors.cursor}"></div>
                            </div>
                            <div class="color-preset-description">${preset.description}</div>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="secondary-btn" onclick="this.closest('.color-preset-modal').remove()">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add click handlers
        modal.querySelectorAll('.color-preset-item').forEach(item => {
            item.addEventListener('click', () => {
                const preset = JSON.parse(item.dataset.preset);
                this.settings.terminalColors = preset.colors;
                this.saveSettings();
                this.applySettingsToUI();
                this.applyTerminalSettings();
                modal.remove();
            });
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

}

// Terminal session class
class HubSSHTerminal {
    constructor(session) {
        this.session = session;
        this.socket = null;
        this.term = null;
        this.fitAddon = null;
        this.isConnected = false;
        this.sftpInitialized = false;
        this.downloadCallbacks = new Map(); // Store callbacks for downloads
        this.uploadCallbacks = new Map(); // Store callbacks for uploads
    }

    connect() {
        // Clear the terminal container first
        const terminalElement = document.getElementById('terminal');
        terminalElement.innerHTML = '';
        
        // Get settings from dashboard
        const settings = window.dashboard ? window.dashboard.settings : {
            fontSize: 14,
            fontFamily: 'Fira Code, Consolas, monospace',
            terminalColors: {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#64ffda',
                selection: '#64ffda40'
            }
        };

        // Initialize xterm.js
        this.term = new Terminal({
            cursorBlink: true,
            fontFamily: settings.fontFamily,
            fontSize: settings.fontSize,
            rows: 24, // Set initial rows
            cols: 80, // Set initial cols
            scrollback: settings.advanced ? settings.advanced['terminal-scrollback'] : 1000,
            // Performance optimizations for Docker
            fastScrollModifier: 'alt',
            macOptionIsMeta: false,
            rightClickSelectsWord: true,
            wordSeparator: ' ()[]{}\'"`<>',
            // Buffer optimizations
            allowTransparency: false,
            bellStyle: 'none',
            // Disable some features that can cause performance issues in Docker
            disableStdin: false,
            convertEol: true,
            theme: {
                background: settings.terminalColors.background,
                foreground: settings.terminalColors.foreground,
                cursor: settings.terminalColors.cursor,
                selection: settings.terminalColors.selection,
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
        this.fitAddon = new FitAddon.FitAddon();
        this.term.loadAddon(this.fitAddon);

        // Open terminal
        this.term.open(document.getElementById('terminal'));
        
        // Setup terminal copy handler
        this.setupTerminalCopyHandler();
        
        // Force initial resize
        setTimeout(() => {
            this.fitAddon.fit();
            // Send initial dimensions to server
            if (this.socket && this.socket.readyState === WebSocket.OPEN && this.isConnected) {
                const dimensions = this.fitAddon.proposeDimensions();
                if (dimensions) {
                    this.socket.send(JSON.stringify({
                        type: 'resize',
                        cols: dimensions.cols,
                        rows: dimensions.rows,
                        width: dimensions.width,
                        height: dimensions.height
                    }));
                }
            }
        }, 100);

        // Handle window resize
        this.resizeHandler = () => {
            if (this.fitAddon) {
                this.fitAddon.fit();
                if (this.socket && this.socket.readyState === WebSocket.OPEN && this.isConnected) {
                    const dimensions = this.fitAddon.proposeDimensions();
                    if (dimensions) {
                        this.socket.send(JSON.stringify({
                            type: 'resize',
                            cols: dimensions.cols,
                            rows: dimensions.rows,
                            width: dimensions.width,
                            height: dimensions.height
                        }));
                    }
                }
            }
        };
        
        window.addEventListener('resize', this.resizeHandler);

        // Terminal input handling
        this.term.onData((data) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN && this.isConnected) {
                this.socket.send(JSON.stringify({
                    type: 'data',
                    data: data
                }));
            }
        });

        // Update status
        this.updateStatus('Connecting...', 'connecting');

        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        this.socket = new WebSocket(`${protocol}//${window.location.host}`);
        
        // Set binary type to arraybuffer for proper handling
        this.socket.binaryType = 'arraybuffer';
        
        const connectionTimeout = setTimeout(() => {
            if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
                this.socket.close();
                this.updateStatus('Connection timeout. Please check the server.', 'error');
            }
        }, 15000); // 15 second timeout

        this.socket.onopen = () => {
            clearTimeout(connectionTimeout);
            // Send connection data with session ID for stored credentials
            const connectMessage = {
                type: 'connect',
                sessionId: this.session.sessionId
            };
            this.socket.send(JSON.stringify(connectMessage));
            
            // Send initial resize after connection
            setTimeout(() => {
                if (this.fitAddon) {
                    this.fitAddon.fit();
                    const dimensions = this.fitAddon.proposeDimensions();
                    if (dimensions) {
                        this.socket.send(JSON.stringify({
                            type: 'resize',
                            cols: dimensions.cols,
                            rows: dimensions.rows,
                            width: dimensions.width,
                            height: dimensions.height
                        }));
                    }
                }
            }, 500);
        };

        this.socket.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                // Check if the message is JSON before parsing
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch (e) {
                    // If it's not valid JSON, treat as terminal data
                    this.handleTerminalData(event.data);
                    return;
                }

                // If we successfully parsed JSON, handle based on message type
                switch (message.type) {
                    case 'connected':
                        this.isConnected = true;
                        this.updateStatus('Connected', 'connected');
                        // Display welcome message
                        this.term.writeln('\x1b[32mConnected to SSH server!\x1b[0m');
                        this.term.writeln('');
                        
                        // Send resize after connection to ensure proper sizing
                        setTimeout(() => {
                            if (this.fitAddon) {
                                this.fitAddon.fit();
                                const dimensions = this.fitAddon.proposeDimensions();
                                if (dimensions) {
                                    this.socket.send(JSON.stringify({
                                        type: 'resize',
                                        cols: dimensions.cols,
                                        rows: dimensions.rows,
                                        width: dimensions.width,
                                        height: dimensions.height
                                    }));
                                }
                            }
                        }, 100);
                        break;
                    case 'disconnected':
                        this.isConnected = false;
                        this.updateStatus('Disconnected', 'disconnected');
                        break;
                    case 'error':
                        this.updateStatus(message.message, 'error');
                        this.term.writeln(`\x1b[31mError: ${message.message}\x1b[0m`);
                        break;
                    case 'sftp_ready':
                        this.sftpInitialized = true;
                        if (this.sftpInitCallback) {
                            this.sftpInitCallback();
                        }
                        break;
                    case 'sftp_readdir_result':
                        if (this.readdirCallback) {
                            this.readdirCallback(null, message.files);
                        }
                        break;
                    case 'sftp_stat_result':
                        if (this.statCallback) {
                            this.statCallback(null, message.stats);
                        }
                        break;
                    case 'sftp_file_data':
                        // Handle file download data
                        const callback = this.downloadCallbacks.get(message.fileId);
                        if (callback) {
                            callback(null, new Uint8Array(message.data));
                            this.downloadCallbacks.delete(message.fileId);
                        }
                        break;
                    case 'sftp_upload_success':
                        // Handle file upload success
                        const uploadCallback = this.uploadCallbacks.get(message.fileId);
                        if (uploadCallback) {
                            uploadCallback(null);
                            this.uploadCallbacks.delete(message.fileId);
                        }
                        break;
                    case 'sftp_error':
                        this.updateStatus(message.message, 'error');
                        console.error('SFTP Error:', message.message);
                        // Handle SFTP errors
                        if (this.readdirCallback) {
                            this.readdirCallback(new Error(message.message));
                        }
                        if (this.statCallback) {
                            this.statCallback(new Error(message.message));
                        }
                        // Handle download/upload errors
                        for (const [fileId, callback] of this.downloadCallbacks.entries()) {
                            callback(new Error(message.message));
                        }
                        for (const [fileId, callback] of this.uploadCallbacks.entries()) {
                            callback(new Error(message.message));
                        }
                        this.downloadCallbacks.clear();
                        this.uploadCallbacks.clear();
                        break;
                    default:
                        // If it's JSON but not a recognized message type, treat as terminal data
                        this.handleTerminalData(event.data);
                        break;
                }
            } else {
                // Binary data (terminal output)
                this.handleTerminalData(event.data);
            }
        };

        this.socket.onerror = (error) => {
            clearTimeout(connectionTimeout);
            this.updateStatus('Connection error. Check console for details.', 'error');
        };

        this.socket.onclose = () => {
            clearTimeout(connectionTimeout);
            if (this.isConnected) {
                this.updateStatus('Connection closed', 'disconnected');
            }
            this.isConnected = false;
        };
    }

    async handleTerminalData(data) {
        if (this.isConnected) {
            try {
                let text = '';
                if (data instanceof ArrayBuffer) {
                    text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(data));
                } else if (data instanceof Blob) {
                    const arrayBuffer = await data.arrayBuffer();
                    text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(arrayBuffer));
                } else if (typeof data === 'string') {
                    text = data;
                } else {
                    text = new TextDecoder('utf-8', { fatal: false }).decode(
                        data instanceof Uint8Array ? data : new Uint8Array(data)
                    );
                }

                if (text && text.length > 0) {
                    this.term.write(text);
                }
            } catch (e) {
                // Fallback: try to convert to string
                if (data) {
                    this.term.write(data.toString());
                }
            }
        }
    }

    disconnect() {
        // Remove resize event listener
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        
        if (this.term) {
            this.term.dispose();
            this.term = null;
        }
        
        this.isConnected = false;
        this.sftpInitialized = false;
        this.updateStatus('Disconnected', 'disconnected');
        
        // Clear the terminal container
        const terminalElement = document.getElementById('terminal');
        terminalElement.innerHTML = '';
        
        // Show dashboard
        if (window.dashboard) {
            window.dashboard.showView('dashboard');
        }
    }

    updateStatus(message, type = '') {
        const statusElement = document.getElementById('session-status');
        statusElement.textContent = message;
        statusElement.className = 'session-status ' + type;
    }

setupTerminalCopyHandler() {
    // Проверяем, что терминал существует и открыт
    if (!this.term || !this.term.element) {
        console.error('Terminal not initialized');
        return;
    }
    
    const terminalElement = this.term.element;
    
    // Используем обработчик БЕЗ capture phase
    document.addEventListener('keydown', (e) => {
        // Проверяем Ctrl+Shift+C
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyC') {
            // Проверяем, что фокус в терминале
            if (terminalElement.contains(document.activeElement) || 
                document.activeElement === terminalElement) {
                
                // Проверяем наличие выделенного текста
                if (this.term.hasSelection && this.term.hasSelection()) {
                    e.preventDefault();
                    
                    const selectedText = this.term.getSelection();
                    
                    // Проверяем доступность Clipboard API
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(selectedText).then(() => {
                        }).catch(err => {
                            this.fallbackCopyTextToClipboard(selectedText);
                        });
                    } else {
                        // Используем fallback метод если Clipboard API недоступен
                        this.fallbackCopyTextToClipboard(selectedText);
                    }
                } else {
                    // Если нет выделенного текста, просто блокируем DevTools
                    e.preventDefault();
                }
            }
        }
    }); // БЕЗ capture phase (убрали true)
}
    
    showCopyFeedback(terminalElement) {
        // Optional: show visual feedback when text is copied
        // This could be a temporary message or highlight effect
        console.log('Text copied from terminal');
    }
    
    fallbackCopyTextToClipboard(text) {
        // Fallback method for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                console.log('Text copied to clipboard (fallback method)');
            } else {
                console.error('Failed to copy text (fallback method)');
            }
        } catch (err) {
            console.error('Failed to copy text (fallback method)', err);
        }
        
        document.body.removeChild(textArea);
    }

    // SFTP Methods
    initSftp(callback) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            const error = new Error('Cannot initialize SFTP: No active SSH connection');
            console.error(error.message);
            if (callback) callback(error);
            return;
        }
        
        // Set a timeout for SFTP initialization
        const timeout = setTimeout(() => {
            const error = new Error('SFTP initialization timeout');
            console.error(error.message);
            if (callback) callback(error);
        }, 10000); // 10 second timeout
        
        this.sftpInitCallback = (err) => {
            clearTimeout(timeout);
            if (callback) callback(err);
        };
        
        this.socket.send(JSON.stringify({ type: 'sftp_init' }));
    }

    listDirectory(path, callback) {
        if (!this.sftpInitialized) {
            console.error('SFTP not initialized');
            callback(new Error('SFTP not initialized'));
            return;
        }
        
        this.readdirCallback = callback;
        this.socket.send(JSON.stringify({ type: 'sftp_readdir', path: path }));
    }

    stat(path, callback) {
        if (!this.sftpInitialized) {
            console.error('SFTP not initialized');
            callback(new Error('SFTP not initialized'));
            return;
        }
        
        this.statCallback = callback;
        this.socket.send(JSON.stringify({ type: 'sftp_stat', path: path }));
    }

    downloadFile(filepath, filename, callback) {
        if (!this.sftpInitialized) {
            const error = new Error('SFTP not initialized');
            console.error('SFTP not initialized');
            // If no callback provided, handle the error directly
            if (callback) {
                callback(error);
            }
            return;
        }
        
        // Generate a unique ID for this download
        const fileId = `${filepath}_${Date.now()}`;
        this.downloadCallbacks.set(fileId, callback);
        
        // Request file download
        this.socket.send(JSON.stringify({ 
            type: 'sftp_download_file', 
            filepath: filepath,
            fileId: fileId
        }));
    }

    uploadFile(file, remotePath, callback) {
        if (!this.sftpInitialized) {
            console.error('SFTP not initialized');
            callback(new Error('SFTP not initialized'));
            return;
        }
        
        // Generate a unique ID for this upload
        const fileId = `${file.name}_${Date.now()}`;
        
        // Read the file as ArrayBuffer
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            
            // Send upload request with file data
            this.socket.send(JSON.stringify({ 
                type: 'sftp_upload_file',
                filename: file.name,
                filepath: remotePath === '~' ? file.name : `${remotePath}/${file.name}`,
                fileId: fileId,
                data: Array.from(new Uint8Array(arrayBuffer)),
                size: file.size
            }));
            
            // Set up callback for upload response
            this.uploadCallbacks.set(fileId, callback);
        };
        
        reader.onerror = (e) => {
            callback(new Error('Failed to read file: ' + e.target.error.message));
        };
        
        reader.readAsArrayBuffer(file);
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new HubSSHDashboard();
    window.dashboard = dashboard; // Make it globally accessible
    
    // Add additional resize handling for terminal
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 1000);
});
