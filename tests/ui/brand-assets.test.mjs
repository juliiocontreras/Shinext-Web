import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (rel) => readFile(new URL(`../../${rel}`, import.meta.url));

const PNG_SIGNATURE = "89504e470d0a1a0a";
const WEBP_CHUNKS = /^(VP8 |VP8L|VP8X|ALPH|ANIM|ANMF|ICCP|EXIF|XMP )$/;

test("brand logo is a well-formed WebP container", async () => {
  const data = await read("brand/shinext-logo.webp");
  assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(data.subarray(8, 12).toString("ascii"), "WEBP");
  assert.equal(
    data.readUInt32LE(4),
    data.length - 8,
    "the RIFF size must cover the whole payload (a missing RIFF padding byte breaks decoders)",
  );

  let offset = 12;
  while (offset + 8 <= data.length) {
    const id = data.subarray(offset, offset + 4).toString("ascii");
    assert.match(id, WEBP_CHUNKS, `unexpected WebP chunk ${JSON.stringify(id)}`);
    const size = data.readUInt32LE(offset + 4);
    assert.ok(offset + 8 + size <= data.length, `${id} chunk declares more data than the file holds`);
    offset += 8 + size + (size % 2);
  }
  assert.equal(offset, data.length, "RIFF chunks must walk exactly to the end of the file");
});

test("PWA icon set and social image are real PNG files with the declared size", async () => {
  const expected = {
    "brand/shinext-icon-192.png": [192, 192],
    "brand/shinext-icon-512.png": [512, 512],
    "brand/shinext-icon-maskable-512.png": [512, 512],
    "brand/apple-touch-icon-180.png": [180, 180],
    "brand/shinext-og.png": [1200, 630],
  };
  for (const [rel, [width, height]] of Object.entries(expected)) {
    const data = await read(rel);
    assert.equal(data.subarray(0, 8).toString("hex"), PNG_SIGNATURE, `${rel} is not a PNG`);
    assert.equal(data.readUInt32BE(16), width, `${rel} width`);
    assert.equal(data.readUInt32BE(20), height, `${rel} height`);
  }
});
