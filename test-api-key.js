import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the config file
const configPath = path.join(__dirname, 'data-storage', 'ai-config.json');

// Read the current config
console.log('Reading current config...');
const configData = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(configData);

console.log('Current config:', JSON.stringify(config, null, 2));

// Update the API key
console.log('Setting API key to "test-api-key-123"...');
config.config.apiKey = 'test-api-key-123';

// Write the updated config back to the file
console.log('Writing updated config...');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

// Verify the update
console.log('Reading updated config...');
const updatedConfigData = fs.readFileSync(configPath, 'utf8');
const updatedConfig = JSON.parse(updatedConfigData);
console.log('Updated config:', JSON.stringify(updatedConfig, null, 2));

console.log('Done!'); 