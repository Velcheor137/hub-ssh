import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, 'data', 'webssh.db');
    }

    async init() {
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        const run = promisify(this.db.run.bind(this.db));

        // Create groups table
        await run(`
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create sessions table
        await run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER DEFAULT 22,
                username TEXT NOT NULL,
                auth TEXT NOT NULL CHECK (auth IN ('password', 'privateKey')),
                password TEXT,
                private_key TEXT,
                passphrase TEXT,
                group_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE SET NULL
            )
        `);

        // Create indexes for better performance
        await run('CREATE INDEX IF NOT EXISTS idx_sessions_group_id ON sessions(group_id)');
        await run('CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(name)');

        console.log('Database tables created successfully');
    }

    // Groups methods
    async createGroup(name) {
        const run = promisify(this.db.run.bind(this.db));
        const result = await run('INSERT INTO groups (name) VALUES (?)', [name]);
        return result && result.lastID ? result.lastID : null;
    }

    async getAllGroups() {
        const all = promisify(this.db.all.bind(this.db));
        return await all('SELECT * FROM groups ORDER BY name');
    }

    async deleteGroup(id) {
        const run = promisify(this.db.run.bind(this.db));
        // First, move all sessions in this group to ungrouped (set group_id to NULL)
        await run('UPDATE sessions SET group_id = NULL WHERE group_id = ?', [id]);
        // Then delete the group
        await run('DELETE FROM groups WHERE id = ?', [id]);
    }

    // Sessions methods
    async createSession(sessionData) {
        const run = promisify(this.db.run.bind(this.db));
        const {
            name, host, port, username, auth, password, privateKey, passphrase, groupId
        } = sessionData;

        const result = await run(`
            INSERT INTO sessions (name, host, port, username, auth, password, private_key, passphrase, group_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, host, port, username, auth, password, privateKey, passphrase, groupId]);

        return result && result.lastID ? result.lastID : (result ? result.lastID : null);
    }

    async getAllSessions() {
        const all = promisify(this.db.all.bind(this.db));
        return await all(`
            SELECT s.*, g.name as group_name
            FROM sessions s
            LEFT JOIN groups g ON s.group_id = g.id
            ORDER BY s.name
        `);
    }

    async getSessionById(id) {
        const get = promisify(this.db.get.bind(this.db));
        return await get('SELECT * FROM sessions WHERE id = ?', [id]);
    }

    async updateSession(id, sessionData) {
        const run = promisify(this.db.run.bind(this.db));
        const {
            name, host, port, username, auth, password, privateKey, passphrase, groupId
        } = sessionData;

        await run(`
            UPDATE sessions 
            SET name = ?, host = ?, port = ?, username = ?, auth = ?, 
                password = ?, private_key = ?, passphrase = ?, group_id = ?
            WHERE id = ?
        `, [name, host, port, username, auth, password, privateKey, passphrase, groupId, id]);

        return id;
    }

    async deleteSession(id) {
        const run = promisify(this.db.run.bind(this.db));
        await run('DELETE FROM sessions WHERE id = ?', [id]);
    }

    async moveSessionToGroup(sessionId, groupId) {
        const run = promisify(this.db.run.bind(this.db));
        await run('UPDATE sessions SET group_id = ? WHERE id = ?', [groupId, sessionId]);
    }

    // Migration methods
    async migrateFromJSON() {
        // Check if database already has data
        const existingSessions = await this.getAllSessions();
        const existingGroups = await this.getAllGroups();
        
        if (existingSessions.length > 0 || existingGroups.length > 0) {
            console.log('Database already contains data, skipping migration');
            return;
        }

        const sessionsFile = path.join(__dirname, 'data', 'sessions.json');
        const groupsFile = path.join(__dirname, 'data', 'groups.json');

        // Migrate groups
        if (fs.existsSync(groupsFile)) {
            try {
                const groups = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
                for (const group of groups) {
                    try {
                        await this.createGroup(group.name);
                    } catch (err) {
                        console.log(`Group ${group.name} already exists, skipping...`);
                    }
                }
                console.log(`Migrated ${groups.length} groups from JSON`);
            } catch (err) {
                console.error('Error migrating groups:', err);
            }
        }

        // Migrate sessions
        if (fs.existsSync(sessionsFile)) {
            try {
                const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
                let migratedCount = 0;
                for (const session of sessions) {
                    try {
                        const sessionId = await this.createSession({
                            name: session.name,
                            host: session.host,
                            port: session.port,
                            username: session.username,
                            auth: session.auth,
                            password: session.password,
                            privateKey: session.privateKey,
                            passphrase: session.passphrase,
                            groupId: session.groupId
                        });
                        if (sessionId) {
                            migratedCount++;
                        }
                    } catch (sessionErr) {
                        console.log(`Failed to migrate session ${session.name}:`, sessionErr.message);
                    }
                }
                console.log(`Migrated ${migratedCount} sessions from JSON`);
            } catch (err) {
                console.error('Error migrating sessions:', err);
            }
        }
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('Database connection closed');
                    }
                    resolve();
                });
            });
        }
    }
}

// Create singleton instance
const database = new Database();

export default database;
