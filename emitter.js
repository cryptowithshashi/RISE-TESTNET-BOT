// emitter.js
// Creates and exports a single EventEmitter instance to be shared across modules.
// This helps prevent circular dependency issues.

const EventEmitter = require('eventemitter3');

// Create a single instance of the event emitter
const emitter = new EventEmitter();

// Export the instance
module.exports = emitter;

