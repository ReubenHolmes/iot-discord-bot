import 'dotenv/config';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command to return the status
const STATUS_COMMAND = {
  name: 'status',
  description: 'Returns the status of the weather sensors',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
}

const PARAMETER_COMMAND = {
  name: 'threshold',
  description: 'Sets the thresholds for the alarm',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      type: 4,
      name: 'min_temp',
      description: 'Minimum temperature threshold to set off the alarm',
      required: false,
      min_value: -273,
      max_value: 199,
    },
    {
      type: 4,
      name: 'max_temp',
      description: 'Maximum temperature threshold to set off the alarm',
      required: false,
      min_value: -272,
      max_value: 200,
    },
    {
      type: 4,
      name: 'min_humidity',
      description: 'Minimum humidity threshold to set off the alarm',
      required: false,
      min_value: 0,
      max_value: 99,
    },
    {
      type: 4,
      name: 'max_humidity',
      description: 'Maximum humidity threshold to set off the alarm',
      required: false,
      min_value: 1,
      max_value: 100,
    },
    {
      type: 4,
      name: 'min_gas',
      description: 'Minimum gas threshold to set off the alarm',
      required: false,
      min_value: -100,
      max_value: 1000,
    },
    {
      type: 4,
      name: 'max_gas',
      description: 'Maximum gas threshold to set off the alarm',
      required: false,
      min_value: -100,
      max_value: 1000,
    },
  ],
}

const ALL_COMMANDS = [TEST_COMMAND, STATUS_COMMAND, PARAMETER_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
