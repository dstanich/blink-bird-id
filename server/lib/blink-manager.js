/**
 * Blink Manager - Node.js wrapper for Python Blink integration
 *
 * This module provides a wrapper for calling the Python
 * blink_manager.py script from Node.js, handling subprocess management
 * and JSON parsing.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_SCRIPT = path.join(__dirname, '../', 'scripts', 'blink_manager.py');

/**
 * Execute a Python blink_manager command and return the JSON result
 *
 * @param {string} command - Command to run (authenticate, download)
 * @param {Object} args - Arguments object with command-specific options
 * @param {Object} env - Environment variables to pass to Python process
 * @returns {Promise<Object>} - Parsed JSON response from Python script
 */
function executeBlinkCommand(command, args = {}, env = {}) {
  return new Promise((resolve, reject) => {
    const processArgs = [PYTHON_SCRIPT, command];

    // Build command arguments
    if (command === 'download') {
      if (args.url) {
        processArgs.push('--url', args.url);
      }
      if (args.savePath) {
        processArgs.push('--save-path', args.savePath);
      }
    } else if (command === 'authenticate') {
      if (args.email) {
        processArgs.push('--email', args.email);
      }
      if (args.password) {
        processArgs.push('--password', args.password);
      }
    } else if (command === 'list') {
      if (args.cameraName) {
        processArgs.push('--camera-name', args.cameraName);
      }
      if (args.sinceTimestamp) {
        processArgs.push('--since-timestamp', args.sinceTimestamp);
      }
    }

    // Merge environment variables
    const processEnv = {
      ...process.env,
      ...env
    };

    // Use Python from virtual environment
    const pythonExecutable = path.join(__dirname, '../', '.venv', 'bin', 'python');

    // Spawn Python process
    const pythonProcess = spawn(pythonExecutable, processArgs, {
      env: processEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timeout = null;

    // Collect stdout
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr for logging
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (timeout) clearTimeout(timeout);

      try {
        const result = JSON.parse(stdout);

        if (code === 0 && result.success) {
          resolve(result);
        } else {
          reject({
            exitCode: code,
            result,
            stderr
          });
        }
      } catch (e) {
        reject({
          error: 'Failed to parse Python output',
          stdout,
          stderr,
          exitCode: code
        });
      }
    });

    // Handle errors
    pythonProcess.on('error', (err) => {
      if (timeout) clearTimeout(timeout);
      reject({
        error: 'Failed to spawn Python process',
        details: err.message
      });
    });

    // Set timeout (30 seconds)
    timeout = setTimeout(() => {
      pythonProcess.kill();
      reject({
        error: 'Python process timeout after 30 seconds'
      });
    }, 30000);
  });
}

/**
 * Authenticate with Blink Cloud
 *
 * Checks authentication status and reauthenticates if needed.
 * Supports 2FA authentication.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.email - Blink account email (optional, uses BLINK_EMAIL env var)
 * @param {string} options.password - Blink account password (optional, uses BLINK_PASSWORD env var)
 * @param {string} options.twoFACode - 2FA code if required (optional, uses BLINK_2FA_CODE env var)
 *
 * @returns {Promise<Object>} Authentication result with status
 */
export async function authenticate(options = {}) {
  const env = {};

  if (options.email) env.BLINK_EMAIL = options.email;
  if (options.password) env.BLINK_PASSWORD = options.password;

  return executeBlinkCommand('authenticate', {
    email: options.email,
    password: options.password,
  }, env);
}

/**
 *
 * @param {string} cameraName - Name of the camera to list clips for (optional, defaults to 'all')
 * @param {number} sinceTimestamp - Only list clips created after this Unix timestamp (non-inclusive)
 * @returns {Promise<Object>} List of clips with metadata from Blink cameras
 */
export async function listClips(cameraName = 'all', sinceTimestamp = new Date() - 1 * 60 * 60 * 1000 /* 1 hour ago */) {
  return executeBlinkCommand('list', {
    cameraName,
    sinceTimestamp,
  });
}

/**
 * Download file from Blink cloud given a URL and save it to a local path
 *
 * @param {Object} options - Configuration options
 * @param {number} options.sinceTimestamp - Only download thumbnails after this Unix timestamp (non-inclusive)
 *
 * @returns {Promise<Object>} Download result with list of downloaded files
 */
export async function downloadFile(url, savePath) {
  return executeBlinkCommand('download', {
    url,
    savePath,
  });
}

/**
 * Check authentication status with Blink
 *
 * Convenient wrapper that attempts to authenticate if not already authenticated.
 * Returns authentication status without verbose output.
 *
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
export async function isAuthenticated() {
  try {
    const result = await authenticate();
    return result.authenticated === true;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return false;
  }
}
