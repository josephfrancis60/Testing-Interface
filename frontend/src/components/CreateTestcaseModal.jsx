import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Stack, Alert
} from '@mui/material';

const CreateTestcaseModal = ({ open, onClose, onSave, hardwareType }) => {
    const [name, setName] = useState('');
    const [commands, setCommands] = useState('');
    const [error, setError] = useState('');

    const handleSave = () => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        const commandList = commands.split('\n').filter(cmd => cmd.trim());
        if (commandList.length === 0) {
            setError('At least one command is required');
            return;
        }

        onSave({
            name: name.trim(),
            hardwareType,
            commands: commandList
        });
        
        setName('');
        setCommands('');
        setError('');
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Create New TestCase</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                )}
                <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                        label="Testcase Set Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                        required
                    />
                    <TextField
                        label="Commands"
                        multiline
                        rows={6}
                        value={commands}
                        onChange={(e) => setCommands(e.target.value)}
                        fullWidth
                        required
                        placeholder="Enter commands, one per line"
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={{ textTransform:'none' }}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" sx={{ textTransform:'none', backgroundColor:'#0075ff', '&:hover':{backgroundColor:'#0069e6'}}}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateTestcaseModal;