// app.js - wires the twin core together with its feature modules.
import { start } from "./core.js";
import "./simulator.js";   // virtual hand (no phone needed)
import "./recorder.js";    // record & replay
import "./analytics.js";   // metrics, chart, event log
import "./predictor.js";   // forecast fingertip position

start();
