# import serial
# import time
# import logging
# import sys
# from datetime import datetime
# import os
# import argparse
# import json

# class QSwipeTester:
#     def __init__(self, port, baud_rate, num_cycles, commands, command_delay, instance_id, project_name):
#         self.SERIAL_PORT = port
#         self.BAUD_RATE = baud_rate
#         self.NUM_CYCLES = num_cycles
#         self.COMMANDS = commands
#         self.COMMAND_DELAY = command_delay
#         self.INSTANCE_ID = instance_id
#         self.PROJECT_NAME = project_name
#         self.SUCCESS_CODE = 48  # Success feedback code
#         self.TIMEOUT_CODE = 50  # Timeout feedback code
        
#         # Counters and status flags
#         self.count = 0
#         self.error = 0
#         self.timeout = 0
#         self.success_flag = 0
#         self.is_running = True
        
#         # Initialize logging and serial connection
#         self.setup_logging()
#         self.connect_serial()

#     def setup_logging(self):
#         # Create date-based directory
#         current_date = datetime.now().strftime("%Y-%m-%d")
#         self.log_dir = os.path.join('logs', current_date)
#         os.makedirs(self.log_dir, exist_ok=True)
        
#         # Create logger with instance ID
#         self.logger = logging.getLogger(self.INSTANCE_ID)
#         self.logger.setLevel(logging.INFO)
        
#         # Clear any existing handlers
#         self.logger.handlers = []
        
#         # File handler - use project name and instance ID for the log file name
#         log_file = os.path.join(self.log_dir, f'{self.PROJECT_NAME}_{self.INSTANCE_ID}.log')
#         file_handler = logging.FileHandler(log_file)
#         file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
#         self.logger.addHandler(file_handler)
        
#         # Stream handler for real-time output
#         stream_handler = logging.StreamHandler(sys.stdout)
#         stream_handler.setFormatter(logging.Formatter('%(message)s'))
#         self.logger.addHandler(stream_handler)

#     def connect_serial(self):
#         try:
#             self.serial_conn = serial.Serial(self.SERIAL_PORT, self.BAUD_RATE, timeout=1)
#             self.logger.info(f"Connected to {self.SERIAL_PORT} at {self.BAUD_RATE} baud.")
            
#             # Add a small initialization delay and flush buffers
#             time.sleep(0.5)
#             self.serial_conn.reset_input_buffer()
#             self.serial_conn.reset_output_buffer()
            
#         except serial.SerialException as e:
#             self.logger.error(f"Failed to connect to {self.SERIAL_PORT}: {e}")
#             sys.exit(1)

#     def wait_for_feedback(self):
#         feedback_value = None
#         try:
#             # Add a small delay to give device time to respond
#             time.sleep(0.2)
            
#             # Read with timeout
#             start_time = time.time()
#             timeout_duration = 2  # 2 seconds timeout for response
#             fb = None
            
#             while time.time() - start_time < timeout_duration:
#                 if self.serial_conn.in_waiting > 0:
#                     fb = self.serial_conn.readline().strip()
#                     break
#                 time.sleep(0.1)
            
#             self.logger.info(f"Feedback: {fb}")
            
#             # Process the feedback
#             if fb:
#                 try:
#                     # Try to convert the feedback to an integer
#                     if isinstance(fb, bytes):
#                         try:
#                             feedback_value = int(fb.decode('utf-8'))
#                         except (UnicodeDecodeError, ValueError):
#                             try:
#                                 feedback_value = int.from_bytes(fb, "little")
#                             except (ValueError, TypeError):
#                                 feedback_value = None
#                     else:
#                         feedback_value = int(fb) if fb.isdigit() else None
                    
#                     if feedback_value == self.SUCCESS_CODE:
#                         self.success_flag = 1
#                         self.logger.info("Success: Received valid success code (48).")
#                     elif feedback_value == self.TIMEOUT_CODE:
#                         self.success_flag = 0
#                         self.logger.warning("Timeout occurred.")
#                         self.timeout += 1
#                     elif feedback_value == 0:  # Check if feedback is 0 (common for QSwipe)
#                         self.logger.info("Valid feedback received (0). Ready for next command.")
#                         self.success_flag = 1  # Set success flag to 1 for valid feedback
#                     else:
#                         self.success_flag = 0
#                         self.logger.error(f"Error occurred. Feedback value: {feedback_value}")
#                         self.error += 1
#                 except Exception as e:
#                     self.logger.error(f"Error processing feedback: {e}")
#                     self.error += 1
#                     self.success_flag = 0
#             else:
#                 self.logger.error("Received empty feedback or timeout.")
#                 self.timeout += 1
#                 self.success_flag = 0
                
#         except Exception as e:
#             self.logger.error(f"Exception while processing feedback: {e}")
#             self.error += 1
#             self.success_flag = 0
            
#         self.count += 1
        
#         # Return feedback value for validation
#         return feedback_value

#     def send_command(self, command):
#         if not self.is_running:
#             return False
            
#         self.logger.info(f"Sending command: {command}")
#         try:
#             # Flush input buffer before sending a new command
#             self.serial_conn.reset_input_buffer()
            
#             # Send the command
#             self.serial_conn.write(command.encode())
#             self.serial_conn.flush()  # Ensure the command is sent completely
            
#             # Wait for and process feedback
#             feedback_value = self.wait_for_feedback()
            
#             # Return success if feedback is expected value (0 or SUCCESS_CODE)
#             return feedback_value == 0 or feedback_value == self.SUCCESS_CODE
            
#         except serial.SerialTimeoutException:
#             self.logger.error(f"Timeout while sending command: {command}")
#             self.error += 1
#             return False
#         except Exception as e:
#             self.logger.error(f"Exception while sending command: {e}")
#             self.error += 1
#             return False

#     def stop(self):
#         self.is_running = False
#         self.logger.info("Stopping test execution.")
#         self.cleanup()

#     def cleanup(self):
#         if hasattr(self, 'serial_conn'):
#             self.serial_conn.close()
#             self.logger.info("Serial connection closed.")
        
#         self.logger.info(f"Test Summary:")
#         self.logger.info(f"Total commands completed: {self.count}")
#         self.logger.info(f"Total errors encountered: {self.error}")
#         self.logger.info(f"Total timeouts encountered: {self.timeout}")
#         self.logger.info(f"Total cycles completed: {self.count // len(self.COMMANDS) if self.COMMANDS else 0}")

#     def run(self):
#         try:
#             for cycle in range(self.NUM_CYCLES):
#                 if not self.is_running:
#                     break
                
#                 cycle_success = True
#                 self.logger.info(f"Starting cycle {cycle + 1}/{self.NUM_CYCLES}")
                
#                 for i, command in enumerate(self.COMMANDS):
#                     if not self.is_running:
#                         break
                    
#                     # Send command and get validation status
#                     command_success = self.send_command(command)
                    
#                     # If successful feedback is received
#                     if command_success:
#                         self.logger.info(f"Command {i+1}/{len(self.COMMANDS)} succeeded with valid feedback.")
                        
#                         # Apply command delay after successful command before sending the next one
#                         if i < len(self.COMMANDS) - 1:  # Don't delay after the last command in a cycle
#                             self.logger.info(f"Waiting for {self.COMMAND_DELAY} seconds before sending next command...")
#                             time.sleep(self.COMMAND_DELAY)
#                     else:
#                         self.logger.warning(f"Command {i+1}/{len(self.COMMANDS)} failed to receive valid feedback.")
#                         cycle_success = False
#                         # Continue to next command rather than breaking the cycle
                
#                 progress = {
#                     'cycle': cycle + 1,
#                     'total_cycles': self.NUM_CYCLES,
#                     'errors': self.error,
#                     'timeouts': self.timeout,
#                     'cycle_status': 'Success' if cycle_success else 'Failed'
#                 }
                
#                 print(json.dumps(progress))  # Print progress as JSON for easy parsing
#                 self.logger.info(f"Cycle: {cycle + 1}/{self.NUM_CYCLES} completed with status: {'Success' if cycle_success else 'Failed'}")
                
#         except KeyboardInterrupt:
#             self.logger.info("Script interrupted by user.")
#         finally:
#             self.cleanup()

# if __name__ == "__main__":
#     parser = argparse.ArgumentParser(description='QSwipe Hardware Testing Script')
#     parser.add_argument('--port', type=str, default='COM3', help='Serial port')
#     parser.add_argument('--baud', type=int, default=115200, help='Baud rate')
#     parser.add_argument('--cycles', type=int, default=5, help='Number of test cycles')
#     parser.add_argument('--delay', type=float, default=3.0, help='Delay between commands in seconds')
#     parser.add_argument('--commands', type=str, nargs='+', 
#                        default=['e:s:c:e:4:', 'i:', 'e:s:c:e:3:', 'i:', 'e:s:c:e:2:', 'i:', 'e:s:c:e:1:', 'i:'], 
#                        help='Commands to execute')
#     parser.add_argument('--id', type=str, required=True, help='Instance ID for logging')
#     parser.add_argument('--project', type=str, required=True, help='Project Name for logging')

#     args = parser.parse_args()
    
#     # Add newline to commands if not present
#     commands = [cmd if cmd.endswith('\n') else cmd + '\n' for cmd in args.commands]
    
#     tester = QSwipeTester(args.port, args.baud, args.cycles, commands, args.delay, args.id, args.project)
#     tester.run()




import serial
import time
import logging
import sys
from datetime import datetime
import os
import argparse
import json

class QSwipeTester:
    def __init__(self, port, baud_rate, num_cycles, commands, command_delay, instance_id, project_name):
        self.SERIAL_PORT = port
        self.BAUD_RATE = baud_rate
        self.NUM_CYCLES = num_cycles
        self.COMMANDS = commands
        self.COMMAND_DELAY = command_delay
        self.INSTANCE_ID = instance_id
        self.PROJECT_NAME = project_name
        self.SUCCESS_CODE = 48  # Success feedback code
        self.TIMEOUT_CODE = 50  # Timeout feedback code
        
        # Counters and status flags
        self.count = 0
        self.error = 0
        self.timeout = 0
        self.success_flag = 0
        self.is_running = True
        
        # Initialize logging and serial connection
        self.setup_logging()
        self.connect_serial()

    def setup_logging(self):
        # Create date-based directory
        current_date = datetime.now().strftime("%Y-%m-%d")
        self.log_dir = os.path.join('logs', current_date)
        os.makedirs(self.log_dir, exist_ok=True)
        
        # Create logger with instance ID
        self.logger = logging.getLogger(self.INSTANCE_ID)
        self.logger.setLevel(logging.INFO)
        
        # Clear any existing handlers
        self.logger.handlers = []
        
        # File handler - use project name and instance ID for the log file name
        log_file = os.path.join(self.log_dir, f'{self.PROJECT_NAME}_{self.INSTANCE_ID}.log')
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        self.logger.addHandler(file_handler)
        
        # Stream handler for real-time output
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(logging.Formatter('%(message)s'))
        self.logger.addHandler(stream_handler)

    def connect_serial(self):
        try:
            self.serial_conn = serial.Serial(self.SERIAL_PORT, self.BAUD_RATE, timeout=1)
            self.logger.info(f"Connected to {self.SERIAL_PORT} at {self.BAUD_RATE} baud.")
            
            # Add a small initialization delay and flush buffers
            time.sleep(0.5)
            self.serial_conn.reset_input_buffer()
            self.serial_conn.reset_output_buffer()
            
        except serial.SerialException as e:
            self.logger.error(f"Failed to connect to {self.SERIAL_PORT}: {e}")
            sys.exit(1)

    def wait_for_feedback(self):
        feedback_value = None
        try:
            # Add a small delay to give device time to respond
            time.sleep(0.2)
            
            # Read with timeout
            start_time = time.time()
            timeout_duration = 2  # 2 seconds timeout for response
            fb = None
            
            while time.time() - start_time < timeout_duration:
                if self.serial_conn.in_waiting > 0:
                    fb = self.serial_conn.readline().strip()
                    break
                time.sleep(0.1)
            
            self.logger.info(f"Feedback: {fb}")
            
            # Process the feedback
            if fb:
                try:
                    # Try to convert the feedback to an integer
                    if isinstance(fb, bytes):
                        try:
                            feedback_value = int(fb.decode('utf-8'))
                        except (UnicodeDecodeError, ValueError):
                            try:
                                feedback_value = int.from_bytes(fb, "little")
                            except (ValueError, TypeError):
                                feedback_value = None
                    else:
                        feedback_value = int(fb) if fb.isdigit() else None
                    
                    if feedback_value == self.SUCCESS_CODE:
                        self.success_flag = 1
                        self.logger.info("Success: Received valid success code.")
                    elif feedback_value == self.TIMEOUT_CODE:
                        self.success_flag = 0
                        self.logger.warning("Timeout occurred.")
                        self.timeout += 1
                    elif feedback_value == 0:  # Check if feedback is 0 (common for QSwipe)
                        self.logger.info("Valid feedback received. Ready for next command.")
                        self.success_flag = 1  # Set success flag to 1 for valid feedback
                    else:
                        self.success_flag = 0
                        self.logger.error(f"Error occurred. Feedback value: {feedback_value}")
                        self.error += 1
                except Exception as e:
                    self.logger.error(f"Error processing feedback: {e}")
                    self.error += 1
                    self.success_flag = 0
            else:
                self.logger.error("Received empty feedback or timeout.")
                self.timeout += 1
                self.success_flag = 0
                
        except Exception as e:
            self.logger.error(f"Exception while processing feedback: {e}")
            self.error += 1
            self.success_flag = 0
            
        self.count += 1
        
        # Return feedback value for validation
        return feedback_value

    def send_command(self, command):
        if not self.is_running:
            return False
            
        self.logger.info(f"Sending command: {command}")
        try:
            # Flush input buffer before sending a new command
            self.serial_conn.reset_input_buffer()
            
            # Send the command
            self.serial_conn.write(command.encode())
            self.serial_conn.flush()  # Ensure the command is sent completely
            
            # Wait for and process feedback
            feedback_value = self.wait_for_feedback()
            
            # Return True if feedback is 0 (valid feedback)
            return feedback_value == 0
            
        except serial.SerialTimeoutException:
            self.logger.error(f"Timeout while sending command: {command}")
            self.error += 1
            return False
        except Exception as e:
            self.logger.error(f"Exception while sending command: {e}")
            self.error += 1
            return False

    def stop(self):
        self.is_running = False
        self.logger.info("Stopping test execution.")
        self.cleanup()

    def cleanup(self):
        if hasattr(self, 'serial_conn'):
            self.serial_conn.close()
            self.logger.info("Serial connection closed.")
        
        self.logger.info(f"Test Summary:")
        self.logger.info(f"Total commands completed: {self.count}")
        self.logger.info(f"Total errors encountered: {self.error}")
        self.logger.info(f"Total timeouts encountered: {self.timeout}")
        self.logger.info(f"Total cycles completed: {self.count // len(self.COMMANDS) if self.COMMANDS else 0}")

    def run(self):
        try:
            for cycle in range(self.NUM_CYCLES):
                if not self.is_running:
                    break
                
                cycle_success = True
                self.logger.info(f"Starting cycle {cycle + 1}/{self.NUM_CYCLES}")
                
                for i, command in enumerate(self.COMMANDS):
                    if not self.is_running:
                        break
                    
                    # Send command and get validation status
                    valid_feedback = self.send_command(command)
                    
                    # If valid feedback (0) is received
                    if valid_feedback:
                        self.logger.info(f"Command {i+1}/{len(self.COMMANDS)} succeeded with valid feedback.")
                        
                        # Apply command delay after successful command before sending the next one
                        self.logger.info(f"Waiting for {self.COMMAND_DELAY} seconds before sending next command...")
                        time.sleep(self.COMMAND_DELAY)
                    else:
                        self.logger.warning(f"Command {i+1}/{len(self.COMMANDS)} failed to receive valid feedback. Stopping command sequence for this cycle.")
                        cycle_success = False
                        break
                
                progress = {
                    'cycle': cycle + 1,
                    'total_cycles': self.NUM_CYCLES,
                    'errors': self.error,
                    'timeouts': self.timeout,
                    'cycle_completed': cycle_success
                }
                
                print(json.dumps(progress))  # Print progress as JSON for easy parsing
                self.logger.info(f"Cycle: {cycle + 1}/{self.NUM_CYCLES} completed with status: {'Success' if cycle_success else 'Failed'}")
                
        except KeyboardInterrupt:
            self.logger.info("Script interrupted by user.")
        finally:
            self.cleanup()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='QSwipe Hardware Testing Script')
    parser.add_argument('--port', type=str, default='COM3', help='Serial port')
    parser.add_argument('--baud', type=int, default=115200, help='Baud rate')
    parser.add_argument('--cycles', type=int, default=5, help='Number of test cycles')
    parser.add_argument('--delay', type=float, default=3.0, help='Delay between commands in seconds')
    parser.add_argument('--commands', type=str, nargs='+', 
                       default=['e:s:c:e:4:', 'i:', 'e:s:c:e:3:', 'i:', 'e:s:c:e:2:', 'i:', 'e:s:c:e:1:', 'i:'], 
                       help='Commands to execute')
    parser.add_argument('--id', type=str, required=True, help='Instance ID for logging')
    parser.add_argument('--project', type=str, required=True, help='Project Name for logging')

    args = parser.parse_args()
    
    # Add newline to commands if not present
    commands = [cmd if cmd.endswith('\n') else cmd + '\n' for cmd in args.commands]
    
    tester = QSwipeTester(args.port, args.baud, args.cycles, commands, args.delay, args.id, args.project)
    tester.run()