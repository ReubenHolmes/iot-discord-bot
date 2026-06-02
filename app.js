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

const { TB_HOST, DEVICE_TOKEN, API_TOKEN, DISCORD_CHANNEL_ID } = process.env;

// Store the latest telemetry data
let latestTelemetry = {
  temperature: 'N/A',
  humidity: 'N/A',
  gasValue: 'N/A'
};

// Store the Alarm Thresholds
let alarmThresholds = {
  minTemp: -273,
  maxTemp: 200,
  minHumid: 0,
  maxHumid: 100,
  minGas: 0,
  maxGas: 1000
}

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
    const temperature = data.temperature?.[0]?.value;
    const humidity = data.humidity?.[0]?.value;
    const gasValue = data.gasValue?.[0]?.value;

    if (temperature !== undefined) latestTelemetry.temperature = temperature;
    if (humidity !== undefined) latestTelemetry.humidity = humidity;
    if (gasValue !== undefined) latestTelemetry.gasValue = gasValue;

    console.log('✓ Telemetry updated:', latestTelemetry);

    async function sendDiscordAlarm(message) {
      if (!DISCORD_CHANNEL_ID) {
        console.warn('Discord channel ID is not configured. Cannot send alarm message.');
        return;
      }

      try {
        await DiscordRequest(`channels/${DISCORD_CHANNEL_ID}/messages`, {
          method: 'POST',
          body: { content: message },
        });
      } catch (err) {
        console.error('Failed to send Discord alarm:', err.message || err);
      }
    }

    const numericTemperature = typeof temperature === 'string' ? Number(temperature) : temperature;
    const numericHumidity = typeof humidity === 'string' ? Number(humidity) : humidity;
    const numericGasValue = typeof gasValue === 'string' ? Number(gasValue) : gasValue;

    if (typeof numericTemperature === 'number' && !Number.isNaN(numericTemperature)) {
      if (numericTemperature < alarmThresholds.minTemp) {
        const message = `🚨 Alarm: Temperature is below threshold (${numericTemperature} < ${alarmThresholds.minTemp})`;
        console.log(message);
        await sendDiscordAlarm(message);
      } else if (numericTemperature > alarmThresholds.maxTemp) {
        const message = `🚨 Alarm: Temperature is above threshold (${numericTemperature} > ${alarmThresholds.maxTemp})`;
        console.log(message);
        await sendDiscordAlarm(message);
      }
    }

    if (typeof numericHumidity === 'number' && !Number.isNaN(numericHumidity)) {
      if (numericHumidity < alarmThresholds.minHumid) {
        const message = `🚨 Alarm: Humidity is below threshold (${numericHumidity} < ${alarmThresholds.minHumid})`;
        console.log(message);
        await sendDiscordAlarm(message);
      } else if (numericHumidity > alarmThresholds.maxHumid) {
        const message = `🚨 Alarm: Humidity is above threshold (${numericHumidity} > ${alarmThresholds.maxHumid})`;
        console.log(message);
        await sendDiscordAlarm(message);
      }
    }

    if (typeof numericGasValue === 'number' && !Number.isNaN(numericGasValue)) {
      if (numericGasValue < alarmThresholds.minGas) {
        const message = `🚨 Alarm: Gas value is below threshold (${numericGasValue} < ${alarmThresholds.minGas})`;
        console.log(message);
        await sendDiscordAlarm(message);
      } else if (numericGasValue > alarmThresholds.maxGas) {
        const message = `🚨 Alarm: Gas value is above threshold (${numericGasValue} > ${alarmThresholds.maxGas})`;
        console.log(message);
        await sendDiscordAlarm(message);
      }
    }
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
const PORT = process.env.PORT || 3000;

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

      // Refresh telemetry
      await fetchThingsboardTelemetry();

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

    // Change Alarm Thresholds command
    if (name === 'threshold') {
      // Convert options array to a keyed object for easier access
      const user_response = Object.fromEntries(
        (data.options || []).map((option) => [option.name, option.value])
      );

      if (user_response.min_temp !== undefined) alarmThresholds.minTemp = user_response.min_temp;
      if (user_response.max_temp !== undefined) alarmThresholds.maxTemp = user_response.max_temp;
      if (user_response.min_humidity !== undefined) alarmThresholds.minHumid = user_response.min_humidity;
      if (user_response.max_humidity !== undefined) alarmThresholds.maxHumid = user_response.max_humidity;
      if (user_response.min_gas !== undefined) alarmThresholds.minGas = user_response.min_gas;
      if (user_response.max_gas !== undefined) alarmThresholds.maxGas = user_response.max_gas;

      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `Thresholds Updated to:\n\`\`\`Min Temperature: ${alarmThresholds.minTemp}\nMax Temperature: ${alarmThresholds.maxTemp}\nMin Humidity:    ${alarmThresholds.minHumid}\nMax Humidity:    ${alarmThresholds.maxHumid}\nMin Gas Level:   ${alarmThresholds.minGas}\nMax Gas Level:   ${alarmThresholds.maxGas}\n\`\`\``
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

