// recorder.js - history and time travel.
//
// Records every frame the twin receives, then feeds it back through the same
// ingest() path at 1x/2x/4x. The twin re-lives the session and redraws it.
// Recordings can be downloaded and loaded as JSON.

import { ingest, setSource, clearDrawing, logEvent, on, $ } from "./core.js";

let frames = [];          // [msSinceStart, message]
let recording = false, recStart = 0;
let replay = null;        // { i, start, speed }

const duration = () => (frames.length ? frames[frames.length - 1][0] / 1000 : 0);
function info(text) {
  $("recInfo").textContent = text ?? (frames.length
    ? `${frames.length} frames · ${duration().toFixed(1)} s stored`
    : "Nothing recorded yet");
  $("replayBtn").disabled = !frames.length || recording;
  $("dlBtn").disabled = !frames.length || recording;
}

on("frame", m => { if (recording) frames.push([Math.round(performance.now() - recStart), m]); });

function toggleRecord() {
  if (recording) {
    recording = false;
    $("recBtn").textContent = "● Record"; $("recBtn").classList.remove("rec");
    logEvent(`Recorded ${frames.length} frames (${duration().toFixed(1)} s)`, "action");
    info();
  } else {
    if (replay) stopReplay();
    frames = []; recStart = performance.now(); recording = true;
    $("recBtn").textContent = "■ Stop recording"; $("recBtn").classList.add("rec");
    logEvent("Recording started", "action");
    info("Recording… move your hand");
  }
}

function startReplay() {
  if (!frames.length) return;
  if (recording) toggleRecord();
  setSource("replay");
  clearDrawing("replay start");
  replay = { i: 0, start: performance.now(), speed: +$("speedSel").value };
  $("replayBtn").textContent = "■ Stop replay";
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
  $("replayBtn").textContent = "▶ Replay";
  $("replayBar").style.width = "0%";
  if (finished) logEvent("Replay finished", "action");
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
    info();
  } catch {
    info("That file is not a hand-twin recording");
  }
  e.target.value = "";
};
on("source", s => { if (s !== "replay" && replay) { replay = null; $("replayBtn").textContent = "▶ Replay"; $("replayBar").style.width = "0%"; } });

info();
