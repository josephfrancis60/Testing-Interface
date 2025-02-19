import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Stack,
  Alert,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ListSubheader,
} from '@mui/material';
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import HardwareConfig from './HardwareConfig';

const API_BASE_URL = 'http://localhost:3001/api';

// Log Reader Component
const LogReader = ({ instanceId, isRunning }) => {
  const [logContent, setLogContent] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const currentDate = new Date().toISOString().split('T')[0];
        const response = await fetch(`${API_BASE_URL}/logs/${currentDate}/${instanceId}`);
        if (response.ok) {
          const text = await response.text();
          setLogContent(text);
        } else {
          setLogContent(`No log file for this instance.`);
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        setLogContent('Error: Unable to fetch logs.');
      }
    };

    // if (isRunning)  // Fetch logs once when running 
    {
      fetchLogs(); 
      const interval = setInterval(fetchLogs, 1000); // Optionally fetch every second
      return () => clearInterval(interval);
    }
  }, [instanceId, isRunning]);

  return (
    <Box
      sx={{
        bgcolor: 'black',
        color: 'white',
        p: 2,
        borderRadius: 1,
        height: '100%',
        overflow: 'auto',
        // Styles for the scrollbar
        "&::-webkit-scrollbar": { width: {xs: "0px", sm:"7px"} },  // no scrollbar in xs screen size
        "&::-webkit-scrollbar-thumb": { backgroundColor: "#a5a5a5", borderRadius: "10px",},
        "&::-webkit-scrollbar-thumb:hover": { backgroundColor: "#636363" },
        "&::-webkit-scrollbar-track": { backgroundColor: "#f5f5f5", borderRadius: "10px" },
      }}
    >
      {/* <Typography sx={{ mb: 2 }}>Terminal Output (logs):</Typography> */}
      <pre style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
        {logContent || 'No logs available'}
      </pre>
    </Box>
  );
};

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
    numCycles: 10,
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
        commandDelay: 2.0,
        commands: ['#:', 'QR:abc:', '#:', 'BR:123:']
    }
};

// Project categories and their items
const projectCategories = {
  accessories: ['qswipe', 'qtap', 'qba', 'qbq'],
  robots: ['qdesk', 'pro d']
};

const Main = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedInstanceForMenu, setSelectedInstanceForMenu] = useState(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [createAnchorEl, setCreateAnchorEl] = useState(null);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [nameError, setNameError] = useState('');

  // Handle Create Project button click
  const handleCreateClick = (event) => {
    setCreateAnchorEl(event.currentTarget);
  };

  // Handle menu item selection
  const handleMenuItemClick = (type) => {
    setSelectedType(type);
    setCreateAnchorEl(null);
    setNameModalOpen(true);
  };

  // Handle project name submission
  const handleNameSubmit = async () => {
    if (!projectName.trim()) {
      setNameError('Project name is required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/instances/check-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: projectName,
          hardwareType: selectedType 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        setNameError(data.error);
        return;
      }

      // Create new instance with project name
      await fetch(`${API_BASE_URL}/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: projectName,
          hardwareType: selectedType,
          ...defaultConfigs[selectedType]
        })
      });

      setSnackbarMessage(`Project for ${selectedType} created successfully`);
      setOpenSnackbar(true);
      setNameModalOpen(false);
      setProjectName('');
      setNameError('');
      await fetchInstances();
    } catch (err) {
      setNameError('Error creating project');
    }
  };


  const handleMenuOpen = (event, instance) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedInstanceForMenu(instance);
  };

  const handleMenuClose = (event) => {
    if (event) {
      event.stopPropagation();
    }
    setMenuAnchorEl(null);
    setSelectedInstanceForMenu(null);
  };

  const handleDeleteFromMenu = (event) => {
    if (selectedInstanceForMenu) {
      handleDeleteInstance(selectedInstanceForMenu.id, true);
    }
    handleMenuClose(event);
    // Toast
    setSnackbarMessage(`Project Deleted`);
    setOpenSnackbar(true);
  };

  const fetchInstances = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/instances`);
      if (!response.ok) throw new Error('Failed to fetch instances');
      const data = await response.json();
      setInstances(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(() => {
      if (instances.some(instance => instance.status === 'running')) {
        fetchInstances();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [instances]);

  const handleDeleteInstance = async (id, fromCard = false) => {
    try {
      await fetch(`${API_BASE_URL}/instances/${id}`, { method: 'DELETE' });
      await fetchInstances();
      if (!fromCard) {
        setModalOpen(false);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    // backgroundcolor  
    <Box sx={{ p: 3, backgroundColor: '#FAF9F6', minHeight: '100vh' }}>  
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight:'bold', }}>
          Continuous Testing Dashboard
        </Typography>

        <Button
          variant="contained"
          onClick={handleCreateClick}
          endIcon={<KeyboardArrowDownIcon />}
          sx={{ 
            background: "linear-gradient(to bottom right, #33bfff, #5d5ce5)",
            textTransform: 'none',
            fontWeight: 'bold', marginLeft:'20px'
          }}
        >
          Create Project
        </Button>

        <Menu
          anchorEl={createAnchorEl}
          open={Boolean(createAnchorEl)}
          onClose={() => setCreateAnchorEl(null)}
        >
          <ListSubheader sx={{ backgroundColor:'#e5e5e5' }}>Accessories</ListSubheader>
          {projectCategories.accessories.map((type) => (
            <MenuItem 
              key={type} 
              onClick={() => handleMenuItemClick(type)}
              sx={{ textTransform: 'capitalize' }}
            >
              {type}
            </MenuItem>
          ))}
          <ListSubheader sx={{ backgroundColor:'#e5e5e5' }}>Robots</ListSubheader>
          {projectCategories.robots.map((type) => (
            <MenuItem 
              key={type} 
              onClick={() => handleMenuItemClick(type)}
              disabled
              sx={{ textTransform: 'capitalize' }}
            >
              {type}
            </MenuItem>
          ))}
        </Menu>
      </Paper>

      
      {/* Instance Cards as grid  */}
      <Grid container spacing={2}>
        {instances.map((instance) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={instance.id}>
            <Card 
                onClick={() => {
                  setSelectedInstance(instance);
                  setModalOpen(true);
                }}
              sx={{ position: "relative", height: "150px", paddingBottom: "40px", cursor: "pointer" }}>
              {/* Clickable Card Content */}
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {instance.project_name}
                </Typography>
                <Typography sx={{ textTransform: 'capitalize', color: 'text.secondary' }}>
                  {instance.hardware_type}
                </Typography>
                <Typography color="text.secondary">
                  Status: {instance.status}
                </Typography>

                <Typography color="text.secondary" sx={{ fontSize: '0.800rem', marginTop:'20px', fontStyle:'italic',  }}>
                  Created: {new Date(instance.created_at).toLocaleDateString()}
                </Typography>
              </CardContent>

              {/* Status Indicator (Blinking for 'running') */}
              <Box
                sx={{
                  position: "absolute",
                  top: 15,
                  right: 15,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: instance.status === "running" ? "green" : "grey",
                  animation:
                    instance.status === "running"
                      ? "blink 1s infinite alternate"
                      : "none",
                  "@keyframes blink": {
                    "0%": { opacity: 1 },
                    "100%": { opacity: 0.3 },
                  },
                }}
              />

              {/* Delete Button (Bottom Right) */}
              <IconButton
                sx={{ position: "absolute", bottom: 8, right: 8, color: '#808080' }}
                onClick={(e) => handleMenuOpen(e, instance)}
                
              >
                <MoreVertIcon />
              </IconButton>
            </Card>
          </Grid>
        ))}
      </Grid>


      {/* Project Name Modal */}
      <Dialog
        open={nameModalOpen}
        onClose={() => {
          setNameModalOpen(false);
          setProjectName('');
          setNameError('');
        }}
      >
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              mb: 2, 
              color: 'text.secondary',
              textTransform: 'capitalize',
            }}
          >
            Hardware Type: {selectedType}
          </Typography>
          <TextField
            autoFocus
            variant='standard'
            margin="dense"
            label="Project Name"
            // fullWidth
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            error={Boolean(nameError)}
            helperText={nameError}
            sx={{ width:300 }}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setNameModalOpen(false);
              setProjectName('');
              setNameError('');
            }}
            sx={{ textTransform:'none' }}
          >
            Cancel
          </Button>
          <Button onClick={handleNameSubmit} variant="contained" sx={{ textTransform:'none', backgroundColor: '#0075ff', '&:hover':{backgroundColor:'#0069e6'}, color: '#fff' }}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        // disabled={instance.status === 'running'}
      >
        <MenuItem onClick={handleDeleteFromMenu} sx={{ color: 'black' }}>
          Delete
        </MenuItem>
      </Menu>


      <Dialog 
        open={modalOpen} 
        onClose={() => setModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        {/* <DialogTitle sx={{ textTransform: 'capitalize' }}>{selectedInstance?.id}</DialogTitle> */}
        <DialogContent sx={{ maxHeight: "none", display: "flex", gap: 2 }}>
          {selectedInstance && (
            <Box sx={{ display: 'flex', gap: 2, width: "100%" }}>
              <Box sx={{ flex: 1 }}>
                <HardwareConfig
                  instance={instances.find(i => i.id === selectedInstance.id) || selectedInstance}
                  onUpdate={fetchInstances}
                  onDelete={handleDeleteInstance}
                  onStart={async (id) => {
                    await fetch(`${API_BASE_URL}/instances/${id}/start`, { method: 'POST' });
                    await fetchInstances();
                  }}
                  onStop={async (id) => {
                    await fetch(`${API_BASE_URL}/instances/${id}/stop`, { method: 'POST' });
                    await fetchInstances();
                  }}
                  runningPorts={instances.filter(i => i.status === 'running').map(i => i.port)}
                  handleCloseModal={() => setModalOpen(false)}
                />
              </Box>

              {/* Scrollable Log Box */}
              <Box sx={{ flex: 1, overflowY: "auto", maxHeight: "100%", border: "1px solid #ccc", }}>
                <LogReader 
                  instanceId={selectedInstance.id}
                  isRunning={selectedInstance.status === 'running'}
                />
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button 
            onClick={() => setModalOpen(false)} 
            variant='text' 
            sx={{ textTransform:'none', backgroundColor: '#e9f3fc', color: '#000', '&:hover':{backgroundColor:"#cde5fa"}, right: 10, }}
            >
              Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* snackbar  */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={2000}
        onClose={() => setOpenSnackbar(false)}
      >
        <Alert
          onClose={() => setOpenSnackbar(false)}
          severity={snackbarMessage.includes('ed') ? 'success' : 'error'}
          sx={{width: '100%'}}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

    </Box>
  );
};

export default Main;