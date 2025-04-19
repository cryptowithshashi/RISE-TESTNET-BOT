// index.js
// Main entry point for the application.
// Prompts user for repetitions, initializes the TUI, and starts the bot logic.

const readline = require('readline');
// *** CHANGE: Require the shared emitter instance ***
const emitter = require('./emitter');
// *** CHANGE: Only require necessary functions ***
const { initializeTui } = require('./tui');
const { initializeBot, runSimulation } = require('./bot');

// --- Function to ask for repetitions ---
// (Keep askForRepetitions function as in your version)
function askForRepetitions() {
    // Create a readline interface
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        const promptUser = () => {
            rl.question('How many times to repeat the tasks per wallet? (Enter a number > 0): ', (answer) => {
                const parsedAnswer = parseInt(answer, 10);

                // Validate the input
                if (!isNaN(parsedAnswer) && parsedAnswer > 0) {
                    rl.close(); // Close the readline interface
                    resolve(parsedAnswer); // Resolve the promise with the valid number
                } else {
                    console.log('Invalid input. Please enter a number greater than 0.');
                    promptUser(); // Ask again
                }
            });
        };
        promptUser(); // Initial prompt
    });
}


// --- Error Handling ---
// (Keep the existing process.on('uncaughtException') and process.on('unhandledRejection') handlers)
// It's generally better to let these log and exit, trying to interact with TUI here can be unreliable.
process.on('uncaughtException', (error) => {
  console.error('\nFATAL UNCAUGHT EXCEPTION:', error);
  // Attempt to clean up screen if possible, otherwise just exit
  try {
      // Check if screen exists and destroy it (screen is defined in tui.js scope)
      // This might not work reliably if the error happened before tui initialization
      if (typeof screen !== 'undefined' && screen && screen.destroy) {
          screen.destroy();
          console.error('Attempted TUI cleanup.');
      }
  } catch (e) {
      console.error("Error destroying screen during exception:", e);
  } finally {
      process.exit(1); // Exit after attempting cleanup
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\nUNHANDLED REJECTION:');
  console.error('Reason:', reason);
  // Avoid interacting with TUI here, just log
   if (emitter) {
       // Maybe emit a simple console log event if needed elsewhere
       // emitter.emit('log', { level: 'ERROR', message: `UNHANDLED REJECTION: ${reason}` });
   }
  // Decide if you want to exit or just log
  // process.exit(1);
});


// --- Main Application Flow ---
(async () => {
    try {
        // 1. Get the number of repetitions from the user first
        console.log("Starting Rise Testnet Bot...");
        const repetitions = await askForRepetitions();
        // Clear the console before starting TUI (optional)
        // console.clear(); // Uncomment if desired
        console.log(`\nOkay, running ${repetitions} tasks per wallet. Initializing TUI...`);

        // 2. Initialize the TUI
        // This sets up the screen and attaches listeners to the *shared emitter*
        initializeTui();
        // *** Use the shared emitter ***
        emitter.emit('log', { level: 'INFO', message: 'TUI Initialized.' });
        emitter.emit('log', { level: 'INFO', message: `Actions per wallet set to: ${repetitions}` });

        // 3. Initialize the Bot Logic (load wallets, etc.)
        // This will also emit logs to the shared emitter for the TUI to display
        const initSuccess = await initializeBot();

        if (initSuccess) {
            // 4. If initialization succeeded, start the simulation loop
            // Pass the shared emitter if needed, although runSimulation uses the require internally now
            await runSimulation(repetitions); // runSimulation now handles its own interval/stop logic
        } else {
            emitter.emit('log', { level: 'ERROR', message: 'Bot initialization failed. Cannot start simulation.' });
            // Keep TUI running to show the error. User can exit with Ctrl+C.
        }
    } catch (error) {
         // Catch errors from askForRepetitions or other synchronous parts
         console.error("\nError during startup:", error);
         // Ensure TUI is cleaned up if it was initialized
        try {
            if (typeof screen !== 'undefined' && screen && screen.destroy) {
                screen.destroy();
            }
        } catch (e) {
            // Ignore cleanup errors
        }
         process.exit(1);
    }
})(); // Execute the async function immediately

// Application runs: prompts -> initializes TUI -> initializes bot -> runs simulation.
// TUI handles Ctrl+C for graceful exit via the 'stop' event.
// Created by crypto with shashi
