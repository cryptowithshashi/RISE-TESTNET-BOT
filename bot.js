// bot.js
// Contains the core bot logic, reads input files,
// manages state, and emits events for the TUI.

const fs = require('fs');
const path = require('path');
const emitter = require('./emitter'); // Use the shared emitter

// --- Configuration ---
const PVKEY_FILE = path.join(__dirname, 'pvkey.txt');
const MAIL_FILE = path.join(__dirname, 'mail.txt');
// Add other file paths if needed

// --- State ---
let wallets = [];
let mails = [];
let status = 'Initializing...';
let simulationInterval = null; // To hold the interval ID for stopping

// --- Task Definitions ---
// Define the tasks to cycle through during simulation
// Names should correspond to your script files/actions
const SIMULATED_TASKS = [
    { name: 'Send TX', script: 'sendTx.js' }, // Example mapping
    { name: 'Deploy Token', script: 'deployToken.js' },
    { name: 'Send Token', script: 'sendToken.js' },
    { name: 'NFT Collection', script: 'nftCollection.js' },
    { name: 'GasPump Swap', script: 'gasPump.js' },
    { name: 'Clober Swap', script: 'clober.js' },
    { name: 'Inari Finance', script: 'inari.js' },
    { name: 'WL GTX Dex', script: 'wlGtx.js' },
    { name: 'WL Novadubs', script: 'wlNovadubs.js' },
];


// --- Helper Functions ---
// (readFileLines, maskString, loadWallets, loadMails, updateStatus, getCurrentStatusInfo functions remain the same as the previous version)
/**
 * Reads lines from a file asynchronously.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<string[]>} A promise that resolves with an array of lines.
 */
const readFileLines = async (filePath) => {
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        return content.split(/\r?\n/).filter(line => line.trim() !== '');
    } catch (error) {
        if (error.code === 'ENOENT') {
            emitter.emit('log', { level: 'WARN', message: `File not found: ${filePath}. Required for operation.` });
            if (filePath === PVKEY_FILE || filePath === MAIL_FILE) {
                 throw new Error(`Critical file missing: ${path.basename(filePath)}`);
            }
            return [];
        }
        emitter.emit('log', { level: 'ERROR', message: `Error reading file ${filePath}: ${error.message}` });
        throw error;
    }
};

/**
 * Masks a sensitive string.
 * @param {string} str - The string to mask.
 * @param {number} visibleCharsStart - Number of characters visible at the start.
 * @param {number} visibleCharsEnd - Number of characters visible at the end.
 * @returns {string} The masked string.
 */
const maskString = (str, visibleCharsStart = 4, visibleCharsEnd = 4) => {
    if (!str || str.length <= visibleCharsStart + visibleCharsEnd) {
        return str || '';
    }
    const start = str.substring(0, visibleCharsStart);
    const end = str.substring(str.length - visibleCharsEnd);
    return `${start}...${end}`;
};

/**
 * Loads wallets from pvkey.txt. Throws error if file is missing/empty.
 */
const loadWallets = async () => {
    const keys = await readFileLines(PVKEY_FILE);
    if (keys.length === 0) {
        throw new Error(`No private keys found in ${PVKEY_FILE}. Cannot operate.`);
    }
    wallets = keys.map((key, index) => ({
        id: `Wallet ${index + 1}`,
        key: key,
        maskedKey: maskString(key, 6, 4)
    }));
    emitter.emit('log', { level: 'INFO', message: `Loaded ${wallets.length} wallets.` });
};

/**
 * Loads email addresses from mail.txt.
 */
const loadMails = async () => {
    try {
        const lines = await readFileLines(MAIL_FILE);
         if (lines.length === 0) {
             emitter.emit('log', { level: 'WARN', message: `${MAIL_FILE} is empty or not found. Mail-related features may be limited.` });
             mails = [];
             return;
         }
        mails = lines.map((line, index) => {
            const parts = line.split(':');
            const email = parts.length > 1 ? parts[1].trim() : line.trim();
            const id = parts.length > 1 ? parts[0].trim() : `Mail ${index + 1}`;
            return {
                id: id,
                email: email,
                maskedEmail: maskString(email, 4, 10)
            };
        });
        emitter.emit('log', { level: 'INFO', message: `Loaded ${mails.length} mails.` });
    } catch (error) {
         emitter.emit('log', { level: 'ERROR', message: `Failed to load mails: ${error.message}` });
         mails = [];
    }
};

/**
 * Updates the overall status and emits an event.
 * @param {string} newStatus - The new status message.
 */
const updateStatus = (newStatus) => {
    status = newStatus;
    emitter.emit('statusUpdate', getCurrentStatusInfo());
};

/**
 * Gets the current status information object.
 * @returns {object} Status information payload.
 */
const getCurrentStatusInfo = () => ({
    wallets: wallets.map(w => ({ id: w.id, maskedKey: w.maskedKey })),
    mails: mails.map(m => ({ id: m.id, maskedEmail: m.maskedEmail })),
    status: status
});


// --- Core Bot Logic ---

/**
 * Initializes the bot by loading data.
 * Returns true on success, false on failure.
 */
const initializeBot = async () => {
    emitter.emit('log', { level: 'INFO', message: 'Bot initializing...' });
    try {
        updateStatus('Loading Wallets...');
        await loadWallets();

        updateStatus('Loading Mails...');
        await loadMails();

        updateStatus('Idle');
        emitter.emit('log', { level: 'INFO', message: 'Bot initialized successfully.' });
        return true;

    } catch (error) {
        emitter.emit('log', { level: 'ERROR', message: `Initialization failed: ${error.message}` });
        updateStatus('Initialization Error');
        return false;
    }
};

/**
 * Runs the main simulation/task loop, cycling through defined tasks.
 * @param {number} repetitions - How many times to repeat tasks *in total* per wallet.
 */
const runSimulation = async (repetitions) => {
    if (wallets.length === 0) {
         emitter.emit('log', { level: 'ERROR', message: 'No wallets loaded. Cannot start simulation.' });
         updateStatus('Error - No Wallets');
         return;
    }
    if (SIMULATED_TASKS.length === 0) {
        emitter.emit('log', { level: 'ERROR', message: 'No simulated tasks defined. Cannot start simulation.' });
        updateStatus('Error - No Tasks');
        return;
    }

    updateStatus('Running');
    emitter.emit('log', { level: 'INFO', message: `Starting simulation (${repetitions} tasks per wallet)...` });

    let walletIndex = 0;
    let repetitionCounter = 0; // Counts total tasks done for the current wallet
    let overallTaskIndex = 0; // Used to cycle through SIMULATED_TASKS

    // Clear any previous interval
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }

    simulationInterval = setInterval(async () => {
        const currentWallet = wallets[walletIndex];
        repetitionCounter++;

        // Determine which task to simulate based on the overall index
        const taskIndex = overallTaskIndex % SIMULATED_TASKS.length;
        const currentTask = SIMULATED_TASKS[taskIndex];
        overallTaskIndex++; // Increment for the next cycle

        // *** CHANGE: Log includes task name and repetition count ***
        emitter.emit('log', { level: 'INFO', message: `Simulating ${currentTask.name} (${repetitionCounter}/${repetitions}) for ${currentWallet.id}...` });

        // Simulate different actions (replace with actual script calls later)
        // You could eventually call the actual script function:
        // const scriptFunction = require(`./scripts/${currentTask.script}`).runFunction; // Assuming each script exports its main function
        // await scriptFunction( /* parameters */ );
        const rand = Math.random();
        if (rand < 0.7) {
            emitter.emit('log', { level: 'WAIT', message: `${currentTask.name} (${currentWallet.id}): Waiting for result...` });
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000)); // Simulate delay
            emitter.emit('success', `${currentTask.name} (${currentWallet.id}) completed.`);
        } else if (rand < 0.9) {
             emitter.emit('log', { level: 'WARN', message: `${currentTask.name} (${currentWallet.id}): Minor issue detected.` });
        } else {
             emitter.emit('log', { level: 'ERROR', message: `${currentTask.name} (${currentWallet.id}): Failed!` });
        }

        // Check if repetitions for the current wallet are complete
        if (repetitionCounter >= repetitions) {
            repetitionCounter = 0; // Reset counter for the next wallet
            walletIndex++; // Move to the next wallet

            // Loop back to the first wallet if we've gone through all of them
            if (walletIndex >= wallets.length) {
                walletIndex = 0;
                emitter.emit('log', { level: 'INFO', message: 'Completed a full cycle through all wallets. Repeating...' });
            }
            emitter.emit('log', { level: 'INFO', message: `Moving to ${wallets[walletIndex].id}` });
        }

    }, 3000); // Interval between individual tasks

    // Listen for the stop event from TUI
    emitter.once('stop', () => {
        if (simulationInterval) {
            clearInterval(simulationInterval);
            simulationInterval = null;
            emitter.emit('log', { level: 'INFO', message: 'Simulation stopped by user.' });
            updateStatus('Stopped');
        }
    });
};

// --- Exports ---
module.exports = {
    initializeBot,
    runSimulation,
    getCurrentStatusInfo
};

// created by crypto with shashi
