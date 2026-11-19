// app.js - wires the twin core together with its feature modules.
import { start } from "./core.js";
import "./simulator.js";   // virtual hand (no phone needed)
import "./recorder.js";    // record & replay
import "./analytics.js";   // metrics, chart, event log
import "./predictor.js";   // forecast fingertip position
import "./pose.js";        // second twin: the phone's own orientation (smart parcel)
import "./nav.js";         // left navigation between the twins
import "./games.js";       // Arcade: browser games controlled by the phone
import "./scan.js";        // Object to 3D: webcam photo -> depth AI -> 3D model

start();
