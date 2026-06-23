import { Director } from './director.js';

// Boot the simulation as soon as the script module evaluates. The Director
// constructor wires up the canvas, IPC subscriptions, and the rAF loop.
new Director();
