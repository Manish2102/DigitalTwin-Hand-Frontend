// fonts.js - load the fonts embedded in a .pptx, so slides use the author's typefaces.
//
// PowerPoint stores each embedded font as ppt/fonts/fontN.fntdata in Embedded OpenType (EOT) format. When the EOT is
// not compressed (the usual case), the TrueType font is simply its last FontDataSize bytes, optionally XOR-ed with
// 0x50. Compressed (MicroType Express) fonts are skipped and a similar font is used instead.
// The zip is read with the browser's own DecompressionStream: no extra library.

const td = new TextDecoder();

async function unzip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = new Map();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    entries.set(td.decode(u8.subarray(p + 46, p + 46 + nameLen)), { method, csize, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return {
    has: name => entries.has(name),
    async read(name) {
      const e = entries.get(name);
      if (!e) return null;
      const start = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
      const data = u8.subarray(start, start + e.csize);
      if (e.method === 0) return data.slice();
      if (e.method !== 8) throw new Error("unsupported zip compression");
      const out = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw")));
      return new Uint8Array(await out.arrayBuffer());
    },
  };
}

// EOT -> TrueType bytes, or null when the font is compressed
export function eotToTtf(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const eotSize = dv.getUint32(0, true), dataSize = dv.getUint32(4, true), flags = dv.getUint32(12, true);
  const magic = dv.getUint16(34, true);
  if (magic !== 0x504c) {                                      // not EOT: maybe a plain TrueType / OpenType font
    const tag = dv.getUint32(0);
    return tag === 0x00010000 || tag === 0x4f54544f || tag === 0x74727565 ? u8 : null;
  }
  if (flags & 0x4) return null;                                // MicroType Express compressed
  if (eotSize > u8.length || dataSize > eotSize) return null;
  const ttf = u8.slice(eotSize - dataSize, eotSize);
  if (flags & 0x10000000) for (let i = 0; i < ttf.length; i++) ttf[i] ^= 0x50;
  return ttf;
}

const loaded = new Set();

// returns { loaded: [family names], skipped: [family names] }
export async function loadEmbeddedFonts(buf) {
  const res = { loaded: [], skipped: [] };
  let zip;
  try { zip = await unzip(buf); } catch { return res; }
  const pres = await zip.read("ppt/presentation.xml"), rels = await zip.read("ppt/_rels/presentation.xml.rels");
  if (!pres || !rels) return res;
  const doc = new DOMParser().parseFromString(td.decode(pres), "application/xml");
  const relDoc = new DOMParser().parseFromString(td.decode(rels), "application/xml");
  const target = {};
  for (const r of relDoc.getElementsByTagName("Relationship")) target[r.getAttribute("Id")] = r.getAttribute("Target");
  const jobs = [];
  for (const ef of doc.getElementsByTagNameNS("*", "embeddedFont")) {
    const family = ef.getElementsByTagNameNS("*", "font")[0]?.getAttribute("typeface");
    if (!family) continue;
    for (const [tag, weight, style] of [["regular", 400, "normal"], ["bold", 700, "normal"], ["italic", 400, "italic"], ["boldItalic", 700, "italic"]]) {
      const el = ef.getElementsByTagNameNS("*", tag)[0];
      const rid = el?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? el?.getAttribute("r:id");
      if (!rid || !target[rid]) continue;
      const key = `${family}|${weight}|${style}`;
      if (loaded.has(key)) continue;
      const path = "ppt/" + target[rid].replace(/^\.\//, "").replace(/^\/ppt\//, "");
      jobs.push((async () => {
        try {
          const raw = await zip.read(path);
          const ttf = raw && eotToTtf(raw);
          if (!ttf) { res.skipped.push(family); return; }
          const face = new FontFace(family, ttf, { weight: String(weight), style });
          document.fonts.add(await face.load());
          loaded.add(key); res.loaded.push(family);
        } catch { res.skipped.push(family); }
      })());
    }
  }
  await Promise.all(jobs);
  res.loaded = [...new Set(res.loaded)]; res.skipped = [...new Set(res.skipped)].filter(f => !res.loaded.includes(f));
  return res;
}
