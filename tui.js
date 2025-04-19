// tui.js
// Implements the Blessed Terminal User Interface (TUI).
// Created by crypto with shashi

const blessed = require('blessed');
const bannerText = require('./banner');
// *** CHANGE: Require the shared emitter instance ***
const emitter = require('./emitter');
// *** CHANGE: Only require necessary function(s) from bot.js ***
const { getCurrentStatusInfo } = require('./bot');

// --- TUI Elements ---
// (Keep screen, bannerBox, mainLogBox, successLogBox, statusBox declarations)
let screen;
let bannerBox;
let mainLogBox;
let successLogBox;
let statusBox;

// --- Helper Functions ---
// (Keep getTimestamp, getLogStyle, addLogMessage functions as they were in your version)
/**
 * Gets the current timestamp in HH:MM:SS format.
 * @returns {string} Formatted timestamp.
 */
const getTimestamp = () => {
    // Use 'en-GB' for HH:MM:SS format consistently
    return new Date().toLocaleTimeString('en-GB');
};

/**
 * Maps log levels to icons and colors.
 * @param {string} level - The log level (INFO, WARN, ERROR, SUCCESS, WAIT).
 * @returns {object} Object containing icon and color tag.
 */
const getLogStyle = (level) => {
    switch (level.toUpperCase()) {
        case 'INFO':    return { icon: 'ℹ️ ', colorTag: '{blue-fg}' }; // Informational
        case 'SUCCESS': return { icon: '✅', colorTag: '{green-fg}' }; // Success
        case 'WARN':    return { icon: '⚠️ ', colorTag: '{yellow-fg}' }; // Warning
        case 'ERROR':   return { icon: '🚨', colorTag: '{red-fg}' };   // Error
        case 'WAIT':    return { icon: '⌛', colorTag: '{magenta-fg}' }; // Waiting/Pending
        default:        return { icon: '➡️ ', colorTag: '{white-fg}' }; // Default
    }
};

/**
 * Adds a log message to a Blessed box, handling scrolling.
 * @param {blessed.Widgets.Log} box - The Blessed Log widget.
 * @param {string} message - The message to add.
 */
const addLogMessage = (box, message) => {
    if (!box || !screen) return; // Ensure elements exist
    box.log(message); // Use log method which handles scrolling
    screen.render(); // Re-render the screen after update
};


// --- TUI Initialization ---
const initializeTui = () => {
    // Create a screen object.
    screen = blessed.screen({
        smartCSR: true,
        title: 'Rise Testnet JS Bot',
        fullUnicode: true,
        dockBorders: true,
        autoPadding: true
    });

    // --- Box 1: Top Banner ---
    // (Keep bannerBox definition as in your version)
    bannerBox = blessed.box({
        parent: screen,
        top: 0,
        left: 0,
        width: '100%',
        height: 3, // Minimal height for one line + borders
        content: `{center}{bold}${bannerText}{/bold}{/center}`,
        tags: true,
        border: {
            type: 'line'
        },
        style: {
            fg: 'white',
            border: {
                fg: 'blue'
            },
            bold: true
        }
    });

    // --- Box 2: Main Log Area ---
    // (Keep mainLogBox definition as in your version, ensure height is correct)
     mainLogBox = blessed.log({ // Use Log widget for automatic scrolling
        parent: screen,
        label: ' Main Log ', // Label appears on the border
        top: 3, // Below banner
        left: 0,
        width: '65%',
        // *** Ensure height calculation is correct, e.g., 100% minus banner height ***
        height: '100%-3',
        tags: true,
        border: {
            type: 'line'
        },
        style: {
            fg: 'white',
            border: {
                fg: 'cyan'
            },
            label: { // Style the label
                fg: 'cyan',
                bold: true
            }
        },
        scrollable: true,
        alwaysScroll: true, // Scroll automatically on new content
        scrollbar: { // Add a scrollbar
            ch: ' ',
            track: { bg: 'grey' },
            style: { bg: 'cyan' }
        },
        mouse: true, // Enable mouse interaction (scrolling)
        keys: true, // Enable key interaction (scrolling)
        vi: true // Use vi keys for scrolling (j/k)
    });


    // --- Box 3: Success Log Area ---
    // (Keep successLogBox definition as in your version)
    successLogBox = blessed.log({
        parent: screen,
        label: ' Success Events ',
        top: 3, // Below banner
        right: 0, // Align to the right
        width: '35%', // Remaining width
        // Adjusted height: 50% of the space below the banner
        height: '50%-3',
        tags: true,
        border: {
            type: 'line'
        },
        style: {
            fg: 'white',
            border: {
                fg: 'green'
            },
             label: {
                fg: 'green',
                bold: true
            }
        },
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
            ch: ' ',
            track: { bg: 'grey' },
            style: { bg: 'green' }
        },
        mouse: true,
        keys: true,
        vi: true
    });

    // --- Box 4: Status / Info Area ---
    // (Keep statusBox definition as in your version)
    statusBox = blessed.box({ // Use Box, content will be overwritten
        parent: screen,
        label: ' Status Info ',
        // *** Using top and bottom for positioning ***
        top: '50%', // Start at 50% down
        bottom: 0,  // Go all the way to the bottom edge of the screen
        right: 0,
        width: '35%', // Same width as Success Log
        tags: true,
        border: {
            type: 'line'
        },
        style: {
            fg: 'white',
            border: {
                fg: 'yellow'
            },
             label: {
                fg: 'yellow',
                bold: true
            }
        },
        scrollable: true, // Keep scrollable in case content overflows
        alwaysScroll: true,
         scrollbar: {
            ch: ' ',
            track: { bg: 'grey' },
            style: { bg: 'yellow' }
        },
        mouse: true,
        keys: true,
        vi: true
    });


    // --- Event Listeners ---

    // Listener for general logs
    emitter.on('log', ({ level, message }) => {
        if (!mainLogBox) return;
        const { icon, colorTag } = getLogStyle(level);
        const formattedMessage = `[${getTimestamp()}] ${colorTag}${icon}${message}{/}`;
        addLogMessage(mainLogBox, formattedMessage); // addLogMessage now calls screen.render()
    });

    // Listener for success-only logs
    emitter.on('success', (message) => {
         if (!successLogBox) return;
         const { icon, colorTag } = getLogStyle('SUCCESS');
         const formattedMessage = `[${getTimestamp()}] ${colorTag}${icon}${message}{/}`;
         addLogMessage(successLogBox, formattedMessage); // addLogMessage now calls screen.render()
    });

    // Listener for status updates
    emitter.on('statusUpdate', (info) => {
        if (!statusBox || !screen) return;
        // *** Make sure info properties exist before accessing ***
        const { wallets = [], mails = [], status = 'N/A' } = info || {};

        let content = `{bold}--- Status: ${status} ---{/bold}\n\n`;
        content += `{bold}Wallets Loaded (${wallets.length}):{/bold}\n`;
        if (wallets && wallets.length > 0) {
            wallets.forEach(w => content += `  - ${w.id || 'N/A'}: ${w.maskedKey || 'N/A'}\n`);
        } else {
            content += `  (No wallets loaded)\n`;
        }
        content += `\n{bold}Mails Loaded (${mails.length}):{/bold}\n`;
        if (mails && mails.length > 0) {
            mails.forEach(m => content += `  - ${m.id || 'N/A'}: ${m.maskedEmail || 'N/A'}\n`);
        } else {
            content += `  (No mails loaded)\n`;
        }

        statusBox.setContent(content);
        screen.render(); // Render after updating content
    });

    // --- Keybindings ---
    // (Keep screen.key(['escape', 'q', 'C-c']) handler as in your version)
    screen.key(['escape', 'q', 'C-c'], (ch, key) => {
        // *** Emit 'stop' to signal the simulation loop to clear its interval ***
        emitter.emit('stop');
        emitter.emit('log', { level: 'INFO', message: 'Exit requested. Cleaning up...' });

        // Give a brief moment for the stop event to be processed before destroying
        setTimeout(() => {
            if (screen) {
                screen.destroy();
            }
            console.log('TUI closed gracefully.');
            process.exit(0);
        }, 100); // 100ms delay
    });


    // --- Initial Rendering ---
    // *** Use the imported function to get initial status ***
    const initialStatus = getCurrentStatusInfo();
    // *** Emit status update AFTER attaching listener ***
    emitter.emit('statusUpdate', initialStatus);

    screen.render();
    mainLogBox.focus();

    // Handle terminal resize
    screen.on('resize', () => {
        // Re-emit status to potentially redraw elements correctly
        emitter.emit('statusUpdate', getCurrentStatusInfo());
        screen.render();
    });
};

// Export the initialization function
module.exports = { initializeTui };

