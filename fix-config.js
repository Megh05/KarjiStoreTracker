import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the config file
const configPath = path.join(__dirname, 'data-storage', 'ai-config.json');

// Read the current config
try {
  console.log('Reading config file:', configPath);
  const configData = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);
  
  console.log('Current config:', JSON.stringify(config, null, 2));
  
  let updated = false;
  
  // Check if it's an OpenRouter config with the wrong format
  if (config.provider === 'openrouter') {
    console.log('Found OpenRouter config, checking format...');
    
    // Preserve any existing API key
    const existingApiKey = config.config.apiKey;
    
    // Check if the API key looks like a valid key (not a placeholder)
    const isPlaceholder = existingApiKey === 'PLEASE_UPDATE_YOUR_API_KEY' || 
                         existingApiKey === 'PLEASE_UPDATE_API_KEY' ||
                         existingApiKey === 'PLEASE_ADD_YOUR_API_KEY';
    
    // NEVER override any non-placeholder API key
    const apiKeyToUse = (existingApiKey && !isPlaceholder) ? 
                        existingApiKey : 
                        '';  // Use empty string instead of placeholder
    
    // Fix the config if needed
    if (config.config.endpoint) {
      console.log('Found OpenRouter config with incorrect format (has endpoint), fixing...');
      
      // Fix the config
      config.config = {
        apiKey: apiKeyToUse,
        model: config.config.model || 'openai/gpt-3.5-turbo'
      };
      
      // Update the timestamp
      config.updatedOnUtc = new Date().toISOString();
      updated = true;
    } else if (!config.config.apiKey) {
      console.log('Found OpenRouter config missing API key, leaving it empty');
      
      // Add empty string instead of placeholder API key
      config.config.apiKey = '';
      
      // Update the timestamp
      config.updatedOnUtc = new Date().toISOString();
      updated = true;
    }
    
    if (updated) {
      // Write the fixed config back to the file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      console.log('Config file updated successfully!');
      console.log('New config:', JSON.stringify(config, null, 2));
    } else {
      console.log('Config file is already in the correct format.');
    }
  } else {
    console.log('Config file is not an OpenRouter config.');
  }
} catch (error) {
  console.error('Error updating config file:', error);
} 