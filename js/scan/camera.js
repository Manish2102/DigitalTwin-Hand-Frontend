// camera.js - the laptop webcam (or any camera the browser can see) and still-image input.
// The video never leaves the page: frames are only drawn to a canvas in memory.

export const MAX_SIDE = 1024;          // photos are shrunk to this many pixels on the long side

let stream = null;

export async function listCameras() {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter(d => d.kind === "videoinput").map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

export async function startCamera(video, deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("this browser has no camera access (open the page over https)");
  stopCamera(video);
  stream = await navigator.mediaDevices.getUserMedia({
    video: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

export function stopCamera(video) {
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  if (video) video.srcObject = null;
}
export const cameraOn = () => !!stream;

function fit(w, h) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  return [Math.round(w * k), Math.round(h * k)];
}

/** Freeze the current video frame (not mirrored, so text on objects reads correctly). */
export function captureFrame(video) {
  const [w, h] = fit(video.videoWidth, video.videoHeight);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(video, 0, 0, w, h);
  return c;
}

/** Load a picture the user chose (for example a photo taken with the phone). */
export async function loadImageFile(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const [w, h] = fit(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return c;
}

export const canvasToBlob = (c, type = "image/jpeg", q = 0.92) => new Promise(res => c.toBlob(res, type, q));
