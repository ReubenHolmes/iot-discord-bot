import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import axios from 'axios';

const { TB_HOST, DEVICE_TOKEN, API_TOKEN } = process.env;

// Store the latest telemetry data
let latestTelemetry = {
  temperature: 'N/A',
  humidity: 'N/A',
  gasValue: 'N/A'
};

// Function to fetch telemetry from ThingsBoard REST API
async function fetchThingsboardTelemetry() {
  if (!API_TOKEN) {
    console.error('API_TOKEN not configured');
    return;
  }

  const authHeader = API_TOKEN.startsWith('ApiKey ') || API_TOKEN.startsWith('Bearer ')
    ? API_TOKEN
    : API_TOKEN.startsWith('tb_')
      ? `ApiKey ${API_TOKEN}`
      : `Bearer ${API_TOKEN}`;

  const headers = {
    'X-Authorization': authHeader,
    'Content-Type': 'application/json',
  };

  try {
    const deviceId = process.env.DEVICE_ID || await getDefaultDeviceId(headers);
    if (!deviceId) {
      console.error('Unable to determine ThingsBoard device ID');
      return;
    }

    const telemetryResponse = await axios.get(
      `https://${TB_HOST}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=temperature,humidity,gasValue`,
      {
        headers,
        timeout: 5000,
      }
    );

    const data = telemetryResponse.data || {};
    if (data.temperature) latestTelemetry.temperature = data.temperature[0]?.value ?? 'N/A';
    if (data.humidity) latestTelemetry.humidity = data.humidity[0]?.value ?? 'N/A';
    if (data.gasValue) latestTelemetry.gasValue = data.gasValue[0]?.value ?? 'N/A';

    console.log('✓ Telemetry updated:', latestTelemetry);
  } catch (error) {
    console.error('Error fetching telemetry:', error.response?.data || error.message);
  }
}

async function getDefaultDeviceId(headers) {
  try {
    const response = await axios.get(
      `https://${TB_HOST}/api/tenant/devices?pageSize=100&page=0`,
      {
        headers,
        timeout: 5000,
      }
    );

    const devices = response.data?.data;
    if (Array.isArray(devices) && devices.length > 0) {
      return devices[0]?.id?.id;
    }
  } catch (error) {
    console.error('Error fetching ThingsBoard devices:', error.response?.data || error.message);
  }
  return null;
}

// Fetch telemetry every 30 seconds to keep data fresh
setInterval(fetchThingsboardTelemetry, 30000);
// Initial fetch
fetchThingsboardTelemetry();


// Create an express app
const app = express();
app.use(express.json());
// Get port, or default to 3000
const PORT = process.env.PORT || 1886;
// To keep track of our active games
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data, token } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `I love IoT Programming ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // "status" command
    if (name === 'status') {
      if (!API_TOKEN) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.IS_COMPONENTS_V2,
            components: [
              {
                type: MessageComponentTypes.TEXT_DISPLAY,
                content: `ThingsBoard API_TOKEN is not configured.`
              }
            ]
          },
        });
      }

      // Send telemetry data from cached REST API data (no delay needed since data is cached)
      const temperature = latestTelemetry.temperature ?? 'N/A';
      const humidity = latestTelemetry.humidity ?? 'N/A';
      const gasLevel = latestTelemetry.gasValue ?? 'N/A';

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `:thermometer: Temperature: ${temperature}\n:droplet: Humidity: ${humidity}\n:biohazard: Gas level: ${gasLevel}`
            }
          ]
        },
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});

