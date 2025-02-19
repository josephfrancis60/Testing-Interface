import serial
import time
import logging
import sys
from datetime import datetime
import os
import argparse
import json

class QBATester:
    def __init__(self, port, baud_rate, num_cycles, commands, command_delay, instance_id):
        self.SERIAL_PORT = port
        self.BAUD_RATE = baud_rate
        self.NUM_CYCLES = num_cycles
        self.COMMANDS = commands
        self.COMMAND_DELAY = command_delay
        self.INSTANCE_ID = instance_id
        self.SUCCESS_CODE = 0
        self.TIMEOUT_CODE = 13
        
        self.count = 0
        self.error = 0
        self.timeout = 0
        self.success_flag = 0
        self.is_running = True
        
        self.setup_logging()
        self.connect_serial()

    def setup_logging(self):
        current_date = datetime.now().strftime("%Y-%m-%d")
        self.log_dir = os.path.join('logs', current_date)
        os.makedirs(self.log_dir, exist_ok=True)
        
        self.logger = logging.getLogger(self.INSTANCE_ID)
        self.logger.setLevel(logging.INFO)
        
        # Clear existing handlers
        self.logger.handlers = []
        
        # File handler
        log_file = os.path.join(self.log_dir, f'{self.INSTANCE_ID}.log')
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        self.logger.addHandler(file_handler)
        
        # Stream handler
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(logging.Formatter('%(message)s'))
        self.logger.addHandler(stream_handler)

    def connect_serial(self):
        try:
            self.serial_conn = serial.Serial(self.SERIAL_PORT, self.BAUD_RATE, timeout=1)
            self.logger.info(f"Connected to {self.SERIAL_PORT} at {self.BAUD_RATE} baud.")
        except serial.SerialException as e:
            self.logger.error(f"Failed to connect to {self.SERIAL_PORT}: {e}")
            sys.exit(1)

    def wait_for_feedback(self):
        try:
            fb = self.serial_conn.readline().strip()
            self.logger.info(f"Feedback: {fb}")
            
            if fb:
                feedback_value = int(fb)
                if feedback_value == self.SUCCESS_CODE:
                    self.success_flag = 1
                elif feedback_value == self.TIMEOUT_CODE:
                    self.success_flag = 0
                    self.logger.warning("Timeout occurred.")
                    self.timeout += 1
                else:
                    self.success_flag = 0
                    self.logger.error(f"Unexpected feedback code: {feedback_value}")
                    self.error += 1
            else:
                self.error += 1
                
        except ValueError as ve:
            self.logger.error(f"ValueError in feedback processing: {ve}")
            self.error += 1
        except Exception as e:
            self.logger.error(f"Exception while processing feedback: {e}")
            self.error += 1
            
        self.count += 1
        time.sleep(self.COMMAND_DELAY)

    def send_command(self, command):
        if not self.is_running:
            return
            
        self.logger.info(f"Sending command: {command}")
        try:
            self.serial_conn.write(command.encode())
            self.wait_for_feedback()
        except serial.SerialTimeoutException:
            self.logger.error(f"Timeout while sending command: {command}")
        except Exception as e:
            self.logger.error(f"Exception while sending command: {e}")

    def stop(self):
        self.is_running = False
        self.logger.info("Stopping test execution.")
        self.cleanup()

    def cleanup(self):
        if hasattr(self, 'serial_conn'):
            self.serial_conn.close()
            self.logger.info("Serial connection closed.")
        
        self.logger.info(f"Total commands executed: {self.count}")
        self.logger.info(f"Total errors encountered: {self.error}")
        self.logger.info(f"Total timeouts encountered: {self.timeout}")
        self.logger.info(f"Total cycles completed: {self.count // len(self.COMMANDS)}")

    def run(self):
        try:
            for cycle in range(self.NUM_CYCLES):
                if not self.is_running:
                    break
                    
                for command in self.COMMANDS:
                    if not self.is_running:
                        break
                    self.send_command(command + '\n')
                
                progress = {
                    'cycle': cycle + 1,
                    'total_cycles': self.NUM_CYCLES,
                    'errors': self.error,
                    'timeouts': self.timeout
                }
                
                print(json.dumps(progress))
                self.logger.info(f"Cycle: {cycle + 1}/{self.NUM_CYCLES} completed.")
                
        except KeyboardInterrupt:
            self.logger.info("Script interrupted by user.")
        finally:
            self.cleanup()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='QBA Testing Script')
    parser.add_argument('--port', type=str, default='COM5', help='Serial port')
    parser.add_argument('--baud', type=int, default=115200, help='Baud rate')
    parser.add_argument('--cycles', type=int, default=5, help='Number of cycles')
    parser.add_argument('--delay', type=float, default=3, help='Delay between commands in seconds')
    parser.add_argument('--commands', type=str, nargs='+', 
                       default=['p:1:b1:1:200:2:200:', 'p:1:b2:1:200:2:200:', 'p:1:b3:1:200:2:200:'], 
                       help='Commands to execute')
    parser.add_argument('--id', type=str, required=True, help='Instance ID')

    args = parser.parse_args()
    
    # Add newline to commands if not present
    commands = [cmd if cmd.endswith('\n') else cmd + '\n' for cmd in args.commands]
    
    tester = QBATester(args.port, args.baud, args.cycles, commands, args.delay, args.id)
    tester.run()