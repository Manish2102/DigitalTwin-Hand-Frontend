// recorder.js - history and time travel.
//
// Records every frame the twin receives, then feeds it back through the same
// ingest() path at 1x/2x/4x. The twin re-lives the session and redraws it.
// Recordings can be downloaded and loaded as JSON.

import { ingest, setSource, clearDrawing, logEvent, on, $ } from "./core.js";
import { setButton } from "./icons.js";
import { toast } from "./ui.js";

let frames = [];          // [msSinceStart, message]
let recording = false, recStart = 0;
let replay = null;        // { i, start, speed }

const duration = () => (frames.length ? frames[frames.length - 1][0] / 1000 : 0);
function info(text) {
  $("recInfo").textContent = text ?? (frames.length ? `Recording ready: ${duration().toFixed(1)} s, ${frames.length} frames` : "");
  $("replayBtn").disabled = !frames.length || recording;
  $("dlBtn").disabled = !frames.length || recording;
}
function resetReplayButton() {
  setButton($("replayBtn"), "play", "Replay");
  $("replayBtn").classList.remove("active");
  $("replayBar").style.width = "0%";
}

on("frame", m => { if (recording) frames.push([Math.round(performance.now() - recStart), m]); });

function toggleRecord() {
  if (recording) {
    recording = false;
    setButton($("recBtn"), "record", "Record"); $("recBtn").classList.remove("is-recording");
    logEvent(`Recorded ${frames.length} frames (${duration().toFixed(1)} s)`, "action");
    toast(frames.length ? `Recording saved (${duration().toFixed(1)} s)` : "Recording stopped - no hand data was captured",
          frames.length ? "success" : "warning");
    info();
  } else {
    if (replay) stopReplay();
    frames = []; recStart = performance.now(); recording = true;
    setButton($("recBtn"), "stop", "Stop recording"); $("recBtn").classList.add("is-recording");
    logEvent("Recording started", "action");
    info("Recording - move your hand");
  }
}

function startReplay() {
  if (!frames.length) return;
  if (recording) toggleRecord();
  setSource("replay");
  clearDrawing("replay start");
  replay = { i: 0, start: performance.now(), speed: +$("speedSel").value };
  setButton($("replayBtn"), "stop", "Stop replay");
  $("replayBtn").classList.add("active");
  logEvent(`Replaying ${duration().toFixed(1)} s at ${replay.speed}×`, "action");
  requestAnimationFrame(step);
}

function step() {
  if (!replay) return;
  const elapsed = (performance.now() - replay.start) * replay.speed;
  while (replay.i < frames.length && frames[replay.i][0] <= elapsed) {
    ingest({ ...frames[replay.i][1], ts: Date.now() }, "replay");
    replay.i++;
  }
  $("replayBar").style.width = `${(replay.i / frames.length) * 100}%`;
  if (replay.i >= frames.length) { stopReplay(true); return; }
  requestAnimationFrame(step);
}

function stopReplay(finished = false) {
  if (!replay) return;
  replay = null;
  resetReplayButton();
  if (finished) { logEvent("Replay finished", "action"); toast("Replay finished", "success"); }
  setSource("phone");
}

$("recBtn").onclick = toggleRecord;
$("replayBtn").onclick = () => (replay ? stopReplay() : startReplay());
$("dlBtn").onclick = () => {
  const blob = new Blob([JSON.stringify({ version: 1, recordedAt: new Date().toISOString(), frames })],
                        { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "hand-twin-recording.json"; a.click();
  URL.revokeObjectURL(a.href);
  toast("Recording downloaded", "success");
};
$("loadBtn").onclick = () => $("loadInput").click();
$("loadInput").onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.frames)) throw new Error("no frames");
    if (recording) toggleRecord();
    frames = data.frames;
    logEvent(`Loaded recording "${file.name}"`, "action");
    toast(`Loaded "${file.name}" - press Replay`, "success");
    info();
  } catch {
    toast("That file is not a hand-twin recording", "danger");
  }
  e.target.value = "";
};
on("source", s => { if (s !== "replay" && replay) { replay = null; resetReplayButton(); } });

info();
