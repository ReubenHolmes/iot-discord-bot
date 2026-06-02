import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

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
  name: 'alarm threshold',
  description: 'Sets the thresholds for the alarm',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: []
}

const ALL_COMMANDS = [TEST_COMMAND, STATUS_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
