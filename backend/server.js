const express = require('express');
const { spawn } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const { SerialPort } = require('serialport');


const app = express();
app.use(cors());
app.use(express.json());

// Hardware-specific default configurations
const defaultConfigs = {
    'qswipe': {
        port: 'COM3',
        baudRate: 115200,
        numCycles: 1,
        commandDelay: 3.0,
        commands: ['e:s:c:e:4:', 'i:', 'e:s:c:e:3:', 'i:', 'e:s:c:e:2:', 'i:', 'e:s:c:e:1:', 'i:']
    },
    'qtap': {
        port: '/dev/ttyUSB0',
        baudRate: 115200,
        numCycles: 5,
        commandDelay: 1.0,
        commands: ['i:', 'r:']
    },
    'qba': {
        port: 'COM5',
        baudRate: 115200,
        numCycles: 5,
        commandDelay: 3,
        commands: [
            'p:1:b1:1:200:2:200:',
            'p:1:b2:1:200:2:200:',
            'p:1:b3:1:200:2:200:'
        ]
    },
    'qbq': {
        port: 'COM7',
        baudRate: 115200,
        numCycles: 5,
        commandDelay: 1.5,
        commands: ['#:', 'QR:abc:', '#:', 'BR:123:']  // Empty array since commands are generated dynamically in the script
    }
};

// Initialize SQLite database
const db = new sqlite3.Database('hardware_tests.db');

// Create tables 
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS hardware_instances (
        id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        hardware_type TEXT NOT NULL,
        port TEXT NOT NULL,
        baud_rate INTEGER NOT NULL,
        num_cycles INTEGER NOT NULL,
        command_delay FLOAT NOT NULL,
        commands TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create table to track last used ID for each hardware type
    db.run(`CREATE TABLE IF NOT EXISTS id_counters (
        hardware_type TEXT PRIMARY KEY,
        last_id INTEGER DEFAULT 0
    )`);

    // Create command sets table
    db.run(`CREATE TABLE IF NOT EXISTS command_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hardware_type TEXT NOT NULL,
        commands TEXT NOT NULL,
        is_default BOOLEAN DEFAULT 0,
        UNIQUE(name, hardware_type)
    )`);

    // Create a function to safely insert default command sets
    const insertDefaultCommandSet = (set) => {
        return new Promise((resolve, reject) => {
            // First check if a default set already exists for this hardware type
            db.get(
                'SELECT id FROM command_sets WHERE hardware_type = ? AND is_default = 1',
                [set.hardware_type],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!row) {
                        // No default set exists, so insert the new one
                        db.run(
                            `INSERT INTO command_sets (name, hardware_type, commands, is_default) 
                             VALUES (?, ?, ?, ?)`,
                            [set.name, set.hardware_type, set.commands, set.is_default],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    } else {
                        // Default set exists, update it if needed
                        db.run(
                            `UPDATE command_sets 
                             SET name = ?, commands = ? 
                             WHERE hardware_type = ? AND is_default = 1`,
                            [set.name, set.commands, set.hardware_type],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    }
                }
            );
        });
    };

    // Insert default command Testcase sets
    const defaultSets = [
        {
            name: 'Default QSwipe Commands',
            hardware_type: 'qswipe',
            commands: JSON.stringify(['e:s:c:e:4:', 'i:', 'e:s:c:e:3:', 'i:', 'e:s:c:e:2:', 'i:', 'e:s:c:e:1:', 'i:']),
            is_default: 1
        },
        {
            name: 'Default QTap Commands',
            hardware_type: 'qtap',
            commands: JSON.stringify(['i:', 'r:']),
            is_default: 1
        },
        {
            name: 'Default QBA Commands',
            hardware_type: 'qba',
            commands: JSON.stringify(['p:1:b1:1:200:2:200:', 'p:1:b2:1:200:2:200:', 'p:1:b3:1:200:2:200:']),
            is_default: 1
        },
        {
            name: 'Default QBQ Commands',
            hardware_type: 'qbq',
            commands: JSON.stringify(['BR:123:', '#:', 'QR:abc:', '#:']),
            is_default: 1
        }
    ];

    // Use Promise.all to insert/update all default sets
    Promise.all(defaultSets.map(set => insertDefaultCommandSet(set)))
        .catch(err => console.error('Error initializing default command sets:', err));


    // defaultSets.forEach(set => {
    //     db.run(`INSERT OR IGNORE INTO command_sets (name, hardware_type, commands, is_default) 
    //             VALUES (?, ?, ?, ?)`,
    //         [set.name, set.hardware_type, set.commands, set.is_default]);
    // });

    // Initialize counters for each hardware type if they don't exist
    db.run(`INSERT OR IGNORE INTO id_counters (hardware_type, last_id) VALUES ('qswipe', 0)`);
    db.run(`INSERT OR IGNORE INTO id_counters (hardware_type, last_id) VALUES ('qtap', 0)`);
    db.run(`INSERT OR IGNORE INTO id_counters (hardware_type, last_id) VALUES ('qba', 0)`); 
    db.run(`INSERT OR IGNORE INTO id_counters (hardware_type, last_id) VALUES ('qbq', 0)`);
});

// Function to get and increment the next ID for a hardware type
const getNextId = (hardwareType) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.get('SELECT last_id FROM id_counters WHERE hardware_type = ?', [hardwareType], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                const nextId = row.last_id + 1;

                db.run('UPDATE id_counters SET last_id = ? WHERE hardware_type = ?', 
                    [nextId, hardwareType], 
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(`${hardwareType}_${nextId}`);
                    }
                );
            });
        });
    });
};

// Store running processes
const runningProcesses = new Map();

// Helper function to get script path
const getScriptPath = (hardwareType) => {
    const scriptMap = {
        'qswipe': 'qswipe_test.py',
        'qtap': 'qtap_test.py',
        'qba': 'qba_test.py',
        'qbq': 'qbq_test.py'
    };
    return path.join(__dirname, 'scripts', scriptMap[hardwareType]);
};

// Add this new endpoint to list available ports
app.get('/api/serial-ports', async (req, res) => {
    try {
        const ports = await SerialPort.list();
        const formattedPorts = ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Unknown',
            serialNumber: port.serialNumber || 'N/A',
            vendorId: port.vendorId || 'N/A',
            productId: port.productId || 'N/A'
        }));
        res.json(formattedPorts);
    } catch (error) {
        console.error('Error listing serial ports:', error);
        res.status(500).json({ error: 'Failed to list serial ports' });
    }
});

// Add new endpoint to check project name availability
app.post('/api/instances/check-name', (req, res) => {
    const { name, hardwareType } = req.body;

    if (!name) {
        res.status(400).json({ error: 'Project name is required' });
        return;
    }

    db.get(
        'SELECT COUNT(*) as count FROM hardware_instances WHERE project_name = ? AND hardware_type = ?',
        [name, hardwareType],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (row.count > 0) {
                res.status(400).json({ 
                    error: `A project with name "${name}" already exists for ${hardwareType}` 
                });
                return;
            }

            res.json({ available: true });
        }
    );
});

// Create new hardware instance
app.post('/api/instances', async (req, res) => {
    const { projectName, hardwareType } = req.body;
    
    try {
        const id = await getNextId(hardwareType);
        
        // Get default configuration for the hardware type
        const defaultConfig = defaultConfigs[hardwareType];
        if (!defaultConfig) {
            throw new Error(`Invalid hardware type: ${hardwareType}`);
        }
        
        // Merge default config with any provided overrides
        const config = {
            ...defaultConfig,
            ...req.body
        };
        
        const stmt = db.prepare(`
            INSERT INTO hardware_instances 
            (id, project_name, hardware_type, port, baud_rate, num_cycles, command_delay, commands) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            id,
            projectName,
            hardwareType,
            config.port,
            config.baudRate,
            config.numCycles,
            config.commandDelay,
            JSON.stringify(config.commands),
            (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.status(201).json({ message: 'Instance created successfully', id });
            }
        );
        stmt.finalize();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Update instance parameters
app.put('/api/instances/:id', (req, res) => {
    const { port, baudRate, numCycles, commandDelay, commands } = req.body;
    const { id } = req.params;
    
    const stmt = db.prepare(`
        UPDATE hardware_instances 
        SET port = ?, baud_rate = ?, num_cycles = ?, command_delay = ?, commands = ?
        WHERE id = ?
    `);
    
    stmt.run(port, baudRate, numCycles, commandDelay, JSON.stringify(commands), id, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Instance updated successfully' });
    });
    stmt.finalize();
});

// Start hardware test
app.post('/api/instances/:id/start', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM hardware_instances WHERE id = ?', [id], (err, instance) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!instance) {
            res.status(404).json({ error: 'Instance not found' });
            return;
        }
        
        // Check if already running
        if (runningProcesses.has(id)) {
            res.status(400).json({ error: 'Instance already running' });
            return;
        }
        
        const scriptPath = getScriptPath(instance.hardware_type);
        const commands = JSON.parse(instance.commands);
        
        const process = spawn('python', [
            scriptPath,
            '--port', instance.port,
            '--baud', instance.baud_rate.toString(),
            '--cycles', instance.num_cycles.toString(),
            '--delay', instance.command_delay.toString(),
            '--id', id,
            '--commands', ...commands
        ]);
        
        runningProcesses.set(id, process);
        
        // Update status in database
        db.run('UPDATE hardware_instances SET status = ? WHERE id = ?', ['running', id]);
        
        // Handle process output
        process.stdout.on('data', (data) => {
            try {
                // Try to parse as JSON for progress updates
                const progress = JSON.parse(data);
                // Here you would emit this to connected WebSocket clients
                console.log(`Progress for ${id}:`, progress);
            } catch {
                // Regular log output
                console.log(`Output from ${id}:`, data.toString());
            }
        });
        
        process.stderr.on('data', (data) => {
            console.error(`Error from ${id}:`, data.toString());
        });
        
        process.on('close', (code) => {
            console.log(`Process ${id} exited with code ${code}`);
            runningProcesses.delete(id);
            db.run('UPDATE hardware_instances SET status = ? WHERE id = ?', ['idle', id]); // Update status to idle
        });
        
        
        res.json({ message: 'Test started successfully' });
    });
});

// Stop hardware test
app.post('/api/instances/:id/stop', (req, res) => {
    const { id } = req.params;
    
    const process = runningProcesses.get(id);
    if (!process) {
        res.status(404).json({ error: 'No running process found for this instance' });
        return;
    }
    
    process.kill();
    runningProcesses.delete(id);
    
    db.run('UPDATE hardware_instances SET status = ? WHERE id = ?', ['idle', id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Test stopped successfully' });
    });
});

// Get all instances
app.get('/api/instances', (req, res) => {
    db.all('SELECT * FROM hardware_instances', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get specific instance
app.get('/api/instances/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM hardware_instances WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Instance not found' });
            return;
        }
        res.json(row);
    });
});

// Delete instance
app.delete('/api/instances/:id', (req, res) => {
    const { id } = req.params;
    
    // Stop if running
    const process = runningProcesses.get(id);
    if (process) {
        process.kill();
        runningProcesses.delete(id);
    }
    
    db.run('DELETE FROM hardware_instances WHERE id = ?', [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Instance deleted successfully' });
    });
});

// for displaying logs 
app.get('/api/logs/:date/:instanceId', async (req, res) => {
    try {
      const { date, instanceId } = req.params;
      const logPath = path.join(__dirname, 'logs', date, `${instanceId}.log`);
      console.log(`Attempting to read log file at: ${logPath}`); // Add this line
      const content = await fs.readFile(logPath, 'utf8');
      res.send(content);
    } catch (error) {
      console.error('Error reading log file:', error);
      res.status(404).send('Log file not found');
    }
  });

  // Get command sets for a specific hardware type
app.get('/api/command-sets/:hardwareType', (req, res) => {
    const { hardwareType } = req.params;
    db.all('SELECT * FROM command_sets WHERE hardware_type = ?', [hardwareType], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create new command set
app.post('/api/command-sets', (req, res) => {
    const { name, hardwareType, commands } = req.body;
    
    db.run(
        'INSERT INTO command_sets (name, hardware_type, commands) VALUES (?, ?, ?)',
        [name, hardwareType, JSON.stringify(commands)],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Add this endpoint to update command sets
app.put('/api/command-sets/:id', (req, res) => {
    const { id } = req.params;
    const { commands, name } = req.body;
    
    // Check if this is a default command set
    db.get('SELECT is_default FROM command_sets WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(404).json({ error: 'Command set not found' });
            return;
        }
        
        if (row.is_default) {
            res.status(403).json({ error: 'Cannot modify default command set' });
            return;
        }
        
        // Prepare update data
        const updateData = {};
        const params = [];
        
        if (commands) {
            updateData.commands = JSON.stringify(commands);
            params.push(updateData.commands);
        }
        
        if (name) {
            updateData.name = name;
            params.push(updateData.name);
        }
        
        if (params.length === 0) {
            res.status(400).json({ error: 'No data provided for update' });
            return;
        }
        
        // Construct SQL update statement
        const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
        params.push(id);
        
        db.run(`UPDATE command_sets SET ${setClause} WHERE id = ?`, params, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            if (this.changes === 0) {
                res.status(404).json({ error: 'Command set not found or no changes made' });
                return;
            }
            
            res.json({ message: 'Command set updated successfully' });
        });
    });
});

// Update instance with selected command set
app.put('/api/instances/:id/command-set', (req, res) => {
    const { id } = req.params;
    const { commandSetId } = req.body;
    
    db.get('SELECT commands FROM command_sets WHERE id = ?', [commandSetId], (err, commandSet) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!commandSet) {
            res.status(404).json({ error: 'Command set not found' });
            return;
        }

        db.run(
            'UPDATE hardware_instances SET commands = ? WHERE id = ?',
            [commandSet.commands, id],
            (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: 'Command set updated successfully' });
            }
        );
    });
});

// Delete command set (prevent deletion of default sets)
app.delete('/api/command-sets/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT is_default FROM command_sets WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(404).json({ error: 'Command set not found' });
            return;
        }
        
        if (row.is_default) {
            res.status(403).json({ error: 'Cannot delete default command set' });
            return;
        }
        
        db.run('DELETE FROM command_sets WHERE id = ?', [id], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Command set deleted successfully' });
        });
    });
});
  

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});