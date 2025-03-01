import React, { useState, useEffect } from 'react';
import {
  Button,
  Typography,
  Stack,
  Alert,
  TextField,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem, FormControl, InputLabel, Select, Box, Tooltip, Snackbar
} from '@mui/material';
import {
  Edit as EditIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import CreateTestcaseModal from './CreateTestcaseModal';

const API_BASE_URL = 'http://localhost:3001/api';

// Port validation dialog component
const PortInUseDialog = ({ open, onClose, portNumber }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Port Already in Use</DialogTitle>
    <DialogContent>
      <Typography>
        Port {portNumber} is currently being used by another running instance. 
        Please choose a different port or wait for the other device to complete.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} variant="contained">
        OK
      </Button>
    </DialogActions>
  </Dialog>
);

const HardwareConfig = ({ instance, onUpdate, onDelete, onStart, onStop, runningPorts, handleCloseModal }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [config, setConfig] = useState({
    ...instance,
    port: instance.port,
    baudRate: parseInt(instance.baud_rate),
    numCycles: parseInt(instance.num_cycles),
    commandDelay: parseFloat(instance.command_delay),
    commands: Array.isArray(instance.commands) ? instance.commands : JSON.parse(instance.commands)
  });
  const [error, setError] = useState('');
  const [showPortDialog, setShowPortDialog] = useState(false);
  const [commandSets, setCommandSets] = useState([]);
  const [selectedCommandSetId, setSelectedCommandSetId] = useState(null);
  const [createCommandModalOpen, setCreateCommandModalOpen] = useState(false);
  const [availablePorts, setAvailablePorts] = useState([]);
  const [portLoading, setPortLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // New state for command editing
  const [isEditingCommands, setIsEditingCommands] = useState(false);
  const [editableCommands, setEditableCommands] = useState('');
  const [originalCommands, setOriginalCommands] = useState([]);

  // Update local state when instance prop changes
  useEffect(() => {
    if (!isEditing) { // Only update if not in editing mode
      setConfig({
        ...instance,
        port: instance.port,
        baudRate: parseInt(instance.baud_rate),
        numCycles: parseInt(instance.num_cycles),
        commandDelay: parseFloat(instance.command_delay),
        commands: Array.isArray(instance.commands) ? instance.commands : JSON.parse(instance.commands)
      });
    }
  }, [instance, isEditing]); // Dependency on instance ensures updates when parent changes

  // Add this function to fetch available ports
  const fetchAvailablePorts = async () => {
    setPortLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/serial-ports`);
        if (!response.ok) throw new Error('Failed to fetch serial ports');
        const ports = await response.json();
        setAvailablePorts(ports);
    } catch (error) {
        setError('Failed to fetch available serial ports');
        console.error(error);
    } finally {
        setPortLoading(false);
    }
  };

  // Add this useEffect to fetch ports when component mounts
  useEffect(() => {
    fetchAvailablePorts();
  }, []);

  useEffect(() => {
      fetchCommandSets();
  }, [instance.hardware_type]);

  const fetchCommandSets = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/command-sets/${instance.hardware_type}`);
        const data = await response.json();
        setCommandSets(data);
        
        // If we already have a selected command set, try to keep it selected
        if (selectedCommandSetId) {
            const commandSetStillExists = data.find(set => set.id === selectedCommandSetId);
            if (commandSetStillExists) {
                // Keep the current selection
                return;
            }
        }
        
        // Otherwise, find a matching set or default
        const currentCommands = JSON.stringify(config.commands);
        const matchingSet = data.find(set => set.commands === currentCommands) || 
                          data.find(set => set.is_default);
        
        if (matchingSet) {
            setSelectedCommandSetId(matchingSet.id);
        }
    } catch (err) {
        setError('Failed to fetch command sets');
    }
  };

  const handleCreateCommandSet = async (newCommandSet) => {
      try {
          const response = await fetch(`${API_BASE_URL}/command-sets`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newCommandSet)
          });
          
          if (!response.ok) throw new Error('Failed to create command set');
          
          await fetchCommandSets();
          setCreateCommandModalOpen(false);
          setSnackbarMessage("Testcase created successfully");
          setOpenSnackbar(true);
      } catch (err) {
          setSnackbarMessage("Testcase in that name already exists");
          setOpenSnackbar(true);
          setCreateCommandModalOpen(false);
      }
  };

  const handleCommandSetChange = async (setId) => {
    try {
      const selectedSet = commandSets.find(set => set.id === setId);
      if (!selectedSet) return;

      // Reset command editing mode if active
      setIsEditingCommands(false);

      // Update the instance with the new command set
      const response = await fetch(`${API_BASE_URL}/instances/${instance.id}/command-set`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandSetId: setId })
      });

      if (!response.ok) throw new Error('Failed to update command set');

      // Update local state
      setSelectedCommandSetId(setId);
      setConfig(prev => ({
        ...prev,
        commands: JSON.parse(selectedSet.commands)
      }));

      await onUpdate();
    } catch (err) {
      setError(err.message);
    }
  };

  // Add useEffect to handle initial command set selection and updates
  useEffect(() => {
    const initializeCommandSet = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/command-sets/${instance.hardware_type}`);
        const data = await response.json();
        setCommandSets(data);
        
        // Find current command set or default
        const currentCommands = JSON.stringify(config.commands);
        const matchingSet = data.find(set => set.commands === currentCommands) || 
                          data.find(set => set.is_default);
        
        if (matchingSet) {
          setSelectedCommandSetId(matchingSet.id);
          setConfig(prev => ({
            ...prev,
            commands: JSON.parse(matchingSet.commands)
          }));
        }
      } catch (err) {
        setError('Failed to fetch command sets');
      }
    };

    initializeCommandSet();
  }, [instance.hardware_type]);

  const handleDeleteCommandSet = async (setId, event) => {
    event.stopPropagation();
    try {
      const response = await fetch(`${API_BASE_URL}/command-sets/${setId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete command set');
      }

      // Fetch updated command sets 
      const updatedSets = await fetch(`${API_BASE_URL}/command-sets/${instance.hardware_type}`);
      const commandSetsData = await updatedSets.json();
      setCommandSets(commandSetsData);

      // Find the default command set
      const defaultSet = commandSetsData.find(set => set.is_default);
      
      if (defaultSet) {
        // Update the selected command set ID
        setSelectedCommandSetId(defaultSet.id);
        
        // Update the config with default commands
        setConfig(prev => ({
          ...prev,
          commands: JSON.parse(defaultSet.commands)
        }));

        // Update the instance on the backend
        await fetch(`${API_BASE_URL}/instances/${instance.id}/command-set`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commandSetId: defaultSet.id })
        });

        // Call onUpdate to refresh the parent component
        await onUpdate();
      }

      // Show success message
      setSnackbarMessage('Test Case Deleted successfully');
      setOpenSnackbar(true);
    } catch (err) {
      setError(err.message);
      setSnackbarMessage('Failed to delete test case');
      setOpenSnackbar(true);
    }
  };

  // New function to handle editing commands
  const handleEditCommands = () => {
    const currentSet = commandSets.find(set => set.id === selectedCommandSetId);
    if (!currentSet) return;
    
    const parsedCommands = JSON.parse(currentSet.commands);
    setOriginalCommands(parsedCommands);
    setEditableCommands(parsedCommands.join('\n'));
    setIsEditingCommands(true);
  };

  // Function to save edited commands
const handleSaveCommands = async () => {
  try {
    // Convert line-separated commands to array
    const commandsArray = editableCommands
      .split('\n')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);
    
    if (commandsArray.length === 0) {
      setSnackbarMessage('Commands cannot be empty');
      setOpenSnackbar(true);
      return;
    }

    // Get current command set
    const currentSet = commandSets.find(set => set.id === selectedCommandSetId);
    if (!currentSet || currentSet.is_default) {
      setSnackbarMessage('Cannot edit default command set');
      setOpenSnackbar(true);
      return;
    }

    // Update the command set in the database
    const response = await fetch(`${API_BASE_URL}/command-sets/${selectedCommandSetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: commandsArray
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update commands');
    }

    // Update local state
    setConfig(prev => ({
      ...prev,
      commands: commandsArray
    }));

    // Update instance with the new commands
    await fetch(`${API_BASE_URL}/instances/${instance.id}/command-set`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandSetId: selectedCommandSetId })
    });

    // Store the current commandSetId before refreshing
    const currentCommandSetId = selectedCommandSetId;
    
    // Refresh command sets
    await fetchCommandSets();
    
    // Explicitly set the selected command set ID back to what it was
    setSelectedCommandSetId(currentCommandSetId);
    
    setIsEditingCommands(false);
    setSnackbarMessage('Commands updated successfully');
    setOpenSnackbar(true);
    await onUpdate();
  } catch (err) {
    setError(err.message);
    setSnackbarMessage('Failed to update commands');
    setOpenSnackbar(true);
  }
};

  // Function to cancel command editing
  const handleCancelEditCommands = () => {
    setIsEditingCommands(false);
    setEditableCommands('');
  };

  const handleStart = async () => {
    if (runningPorts.includes(config.port)) {
      setShowPortDialog(true);
      return;
    }
    await onStart(instance.id);
  };

  const handleInputChange = (field, value) => {
    if (isEditing && instance.status !== 'running') {
      setConfig(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/instances/${instance.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          port: config.port,
          baudRate: parseInt(config.baudRate),
          numCycles: parseInt(config.numCycles),
          commandDelay: parseFloat(config.commandDelay),
          commands: config.commands
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update configuration');
      }
      
      await onUpdate();
      setIsEditing(false);
      setError('');
      setSnackbarMessage('Configuration updated successfully');
      setOpenSnackbar(true);
    } catch (err) {
      setError(err.message);
      setSnackbarMessage(err.message);
      setOpenSnackbar(true);
    }
  };

  // Check if current command set is default
  const isDefaultCommandSet = () => {
    const currentSet = commandSets.find(set => set.id === selectedCommandSetId);
    return currentSet?.is_default || false;
  };

  // Disable inputs when not editing
  const isInputDisabled = !isEditing || instance.status === 'running';

  return (
    <>
      <Card sx={{ minWidth: 300, m: 2, pb: 2.5 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">{instance.id}</Typography>
            <Button 
              onClick={() => {
                if (instance.status !== 'running') {
                  setIsEditing(!isEditing);
                  if (isEditing) {
                    // Reset form when canceling edit
                    setConfig({
                      ...instance,
                      port: instance.port,
                      baudRate: parseInt(instance.baud_rate),
                      numCycles: parseInt(instance.num_cycles),
                      commandDelay: parseFloat(instance.command_delay),
                      commands: Array.isArray(instance.commands) ? instance.commands : JSON.parse(instance.commands)
                    });
                  }
                }
              }}
              color={isEditing ? 'primary' : 'default'}
              disabled={instance.status === 'running'}
              sx={{ textTransform:'none', borderRadius:'4px',backgroundColor:'#cde5fa', color:'#000' }}
            >
              {isEditing ? 'Revert' : 'Configure'} 
            </Button>
          </Stack>

          {/* {error && <Alert severity="error"  sx={{ mb: 2 }}>{error}</Alert>} */}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <FormControl variant="standard" fullWidth>
                <InputLabel>Port</InputLabel>
                <Box sx={{ display:'flex', alignItems:'center', mt:2 }}>
                  <Select
                    fullWidth
                    value={config.port}
                    onChange={(e) => handleInputChange('port', e.target.value)}
                    disabled={isInputDisabled}
                  >
                    {availablePorts.map((port) => (
                      <MenuItem key={port.path} value={port.path}>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography>{port.path}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Serial No: {port.serialNumber}
                            </Typography>
                          </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  <IconButton 
                    onClick={fetchAvailablePorts}
                    disabled={isInputDisabled || portLoading}
                    sx={{ ml: 1 }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Box>
              </FormControl>

              <TextField
                required
                label="Baud Rate"
                variant="standard"
                type="number"
                value={config.baudRate}
                onChange={(e) => handleInputChange('baudRate', e.target.value)}
                disabled={isInputDisabled}
                size="small"
              />

              <TextField
                required
                label="Number of Cycles"
                variant="standard"
                type="number"
                value={config.numCycles}
                onChange={(e) => handleInputChange('numCycles', e.target.value)}
                disabled={isInputDisabled}
                size="small"
              />

              <TextField
                required
                label="Command Delay (Seconds)"
                variant="standard"
                type="number"
                value={config.commandDelay}
                onChange={(e) => handleInputChange('commandDelay', e.target.value)}
                disabled={isInputDisabled}
                inputProps={{ step: "0.1" }}
                size="small"
              />

              <Stack direction="row" spacing={2}>
                <TextField
                    select
                    label="Testcase Selection"
                    value={selectedCommandSetId || ''}
                    onChange={(e) => handleCommandSetChange(e.target.value)}
                    fullWidth
                    disabled={instance.status === 'running'}
                >
                    {commandSets.map(set => (
                        <MenuItem 
                            key={set.id} 
                            value={set.id}
                            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            {set.name}
                            {!set.is_default && (
                                <IconButton
                                    size="small"
                                    onClick={(e) => handleDeleteCommandSet(set.id, e)}
                                    disabled={instance.status === 'running'}
                                    sx={{ ml: 1 }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            )}
                        </MenuItem>
                    ))}
                </TextField>
                
                <Button
                    variant="outlined"
                    onClick={() => setCreateCommandModalOpen(true)}
                    disabled={instance.status === 'running'}
                    sx={{ textTransform: 'none', backgroundColor: '#0075ff', '&:hover':{backgroundColor:"#0069e6"}, color: '#fff' }}
                >
                    Create Testcase
                </Button>
              </Stack>

              {/* Commands Box with Edit Icon */}
              <Box sx={{ position: 'relative' }}>
                {/* Show Edit Icon only for non-default command sets */}
                {!isDefaultCommandSet() && !isEditingCommands && (
                  <IconButton 
                    sx={{ position: 'absolute', top: 0, right: 0, zIndex: 1 }}
                    onClick={handleEditCommands}
                    disabled={instance.status === 'running'}
                    size="small"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
                
                {/* Show either editable or read-only commands */}
                {isEditingCommands ? (
                  <Box>
                    <TextField
                      multiline
                      fullWidth
                      rows={4}
                      value={editableCommands}
                      onChange={(e) => setEditableCommands(e.target.value)}
                      variant="outlined"
                      placeholder="Enter one command per line"
                      size="small"
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button 
                        variant="contained" 
                        startIcon={<SaveIcon />}
                        onClick={handleSaveCommands}
                        sx={{ textTransform: 'none' }}
                      >
                        Save
                      </Button>
                      <Button 
                        variant="outlined" 
                        startIcon={<CancelIcon />}
                        onClick={handleCancelEditCommands}
                        sx={{ textTransform: 'none' }}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  </Box>
                ) : (
                  <TextField
                    label="Commands"
                    multiline
                    sx={{ minWidth:'90%' }}
                    rows={4}
                    value={Array.isArray(config.commands) ? config.commands.join('\n') : config.commands}
                    disabled={true}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>

              <CreateTestcaseModal
                  open={createCommandModalOpen}
                  onClose={() => setCreateCommandModalOpen(false)}
                  onSave={handleCreateCommandSet}
                  hardwareType={instance.hardware_type}
              />

              {isEditing && (
                <Button 
                  type="submit" 
                  variant="contained" 
                  sx={{ mt: 2, textTransform: 'none', maxWidth: '1000px', backgroundColor:'#3391ff', color:'#fff' }}
                >
                  Save Changes
                </Button>
              )}
            </Stack>
          </form>

          <Divider sx={{ my: 2, size:3 }} />

          <Typography variant="subtitle2" color="text.secondary">
            Status: {instance.status}
          </Typography>

          <PortInUseDialog 
            open={showPortDialog}
            onClose={() => setShowPortDialog(false)}
            portNumber={config.port}
          />
        </CardContent>

        <CardActions>
          <Button
            startIcon={<PlayArrowIcon />}
            variant="contained"
            fullWidth
            onClick={handleStart}
            disabled={instance.status === 'running' || isEditing} // Use instance.status for button state
            sx={{ textTransform:'none', background: "linear-gradient(to bottom right, #33bfff, #5d5ce5)", }}
          >
            Run
          </Button>
        
          <Button
            startIcon={<StopIcon />}
            variant="contained"
            color="error"
            fullWidth
            onClick={() => onStop(instance.id)}
            disabled={instance.status !== 'running'} // Use instance.status for button state
            sx={{ textTransform:'none', background: "linear-gradient(to bottom right, #e9f3fc, #cde5fa)", color:'#36454F' }}
          >
            Stop
          </Button>
        </CardActions>
      </Card>

      {/* snackbar */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={2000}
        onClose={() => setOpenSnackbar(false)}
      >
        <Alert
          onClose={() => setOpenSnackbar(false)}
          severity={snackbarMessage.includes('successfully') ? 'success' : 'error'}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default HardwareConfig;