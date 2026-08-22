/**
 * LZX decompression, enough of it to open a CHM.
 *
 * CHM stores its content as one LZX stream ("LZXC") cut into reset intervals:
 * every `resetInterval` frames the coder's state is thrown away and started
 * again, and a reset table gives the compressed byte offset of each restart.
 * That is what makes this tractable — each interval decodes independently, so
 * a mistake cannot silently corrupt everything after it, and the intervals can
 * be checked against each other.
 *
 * Written from the format's own structure rather than ported, on a machine with
 * no CHM tool and no reference implementation to diff against: LZ77 matches over
 * a sliding window, Huffman-coded, with the trees themselves delta-coded against
 * the previous block's through a 20-symbol pretree.
 *
 * THE THING THAT IS EASY TO MISS, and cost most of the effort here: LZX has a
 * unit ABOVE the block. Output is produced in FRAMES of 32,768 bytes, and at
 * every frame boundary the bitstream is re-aligned to the next 16-bit boundary
 * — even in the middle of a block, with no marker in the stream to say so. This
 * file's blocks are 65,536 bytes, two frames each, so exactly one realignment
 * falls inside every block. Without it the first half of each block decodes
 * perfectly and the second half turns into fluent nonsense: real English words
 * spliced out of the wrong topic, which reads as prose and is entirely
 * fabricated. See `FRAME_SIZE` below.
 */

const MIN_MATCH = 2;
const NUM_CHARS = 256;
const BLOCK_VERBATIM = 1, BLOCK_ALIGNED = 2, BLOCK_UNCOMPRESSED = 3;
const PRETREE_ELEMENTS = 20;
const ALIGNED_ELEMENTS = 8;
const SECONDARY_LENGTHS = 249;

/**
 * The frame — LZX's outer unit, and the one the block header says nothing about.
 *
 * Output is emitted in 32,768-byte frames. At the end of each one the encoder
 * pads the bitstream to a 16-bit boundary, so the decoder must discard the
 * leftover bits or every symbol after it is read one to fifteen bits early.
 * The reset table's `blockSize` is this same 32,768, which is the hint that it
 * exists at all.
 */
const FRAME_SIZE = 32768;

const POSITION_BASE = [
  0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768,
  1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576, 32768, 49152,
  65536, 98304, 131072, 196608, 262144, 393216, 524288, 655360, 786432, 917504,
  1048576, 1179648, 1310720, 1441792, 1572864, 1703936, 1835008, 1966080, 2097152,
];
const EXTRA_BITS = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11,
  12, 12, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17,
  17, 17, 17, 17, 17,
];

/** Bits come MSB-first out of a stream of 16-bit little-endian words. */
class BitReader {
  constructor(buf, start) { this.b = buf; this.p = start; this.bits = 0; this.n = 0; }
  ensure(want) {
    while (this.n < want) {
      const lo = this.p < this.b.length ? this.b[this.p] : 0;
      const hi = this.p + 1 < this.b.length ? this.b[this.p + 1] : 0;
      this.p += 2;
      this.bits = ((this.bits << 16) | (hi << 8) | lo) >>> 0;
      this.n += 16;
    }
  }
  read(want) {
    if (want === 0) return 0;
    this.ensure(want);
    const v = (this.bits >>> (this.n - want)) & (want === 32 ? 0xffffffff : (1 << want) - 1);
    this.n -= want;
    this.bits &= (1 << this.n) - 1;
    return v >>> 0;
  }
  /**
   * Discard bits up to the next 16-bit boundary.
   *
   * Nothing happens when the cursor is already on one, which is the whole
   * subtlety: the encoder writes 0 to 15 bits of padding here, not 1 to 16.
   */
  alignWord() { this.n -= this.n % 16; this.bits &= (1 << this.n) - 1; }
}

/** Canonical Huffman: lengths in, a {counts, symbols} decode table out. */
function buildTree(lengths) {
  const maxBits = Math.max(0, ...lengths);
  const counts = new Int32Array(maxBits + 1);
  for (const l of lengths) if (l) counts[l]++;
  const offsets = new Int32Array(maxBits + 2);
  for (let i = 1; i <= maxBits; i++) offsets[i + 1] = offsets[i] + counts[i];
  const symbols = new Int32Array(lengths.length);
  for (let s = 0; s < lengths.length; s++) if (lengths[s]) symbols[offsets[lengths[s]]++] = s;
  return { counts, symbols, maxBits };
}

/** Read one symbol, walking the canonical code one bit at a time. */
function decodeSym(br, tree) {
  let code = 0, first = 0, index = 0;
  for (let len = 1; len <= tree.maxBits; len++) {
    code |= br.read(1);
    const count = tree.counts[len];
    if (code - first < count) return tree.symbols[index + (code - first)];
    index += count;
    first = (first + count) << 1;
    code <<= 1;
  }
  throw new Error("bad huffman code");
}

/**
 * Tree lengths, delta-coded against the previous block's.
 *
 * Every length is expressed as a change from what that symbol had before, which
 * is why a block's trees cannot be read without the last block's — and why a
 * reset has to zero them.
 */
function readLengths(br, lengths, first, last) {
  const preLens = new Uint8Array(PRETREE_ELEMENTS);
  for (let i = 0; i < PRETREE_ELEMENTS; i++) preLens[i] = br.read(4);
  const pre = buildTree(preLens);

  let i = first;
  while (i < last) {
    const sym = decodeSym(br, pre);
    if (sym === 17) {                       // a run of zeros, 4..19
      let run = br.read(4) + 4;
      while (run-- && i < last) lengths[i++] = 0;
    } else if (sym === 18) {                // a longer run of zeros, 20..51
      let run = br.read(5) + 20;
      while (run-- && i < last) lengths[i++] = 0;
    } else if (sym === 19) {                // repeat the NEXT decoded length
      let run = br.read(1) + 4;
      const s = decodeSym(br, pre);
      const v = (lengths[i] - s + 17) % 17;
      while (run-- && i < last) lengths[i++] = v;
    } else {
      lengths[i] = (lengths[i] - sym + 17) % 17;
      i++;
    }
  }
}

/**
 * Decompress one LZX reset interval.
 *
 * `windowBits` sizes the match window; `outLen` is how much this interval is
 * expected to produce, which is also the stopping condition — LZX has no end
 * marker, the container says how much to expect.
 *
 * With a shared output buffer the return value is the byte offset the encoder
 * must have resumed at: the next 16-bit boundary after the bits consumed. For a
 * correct decode that equals the next reset-table entry exactly, which is what
 * makes the result checkable rather than merely plausible.
 */
export function lzxDecompress(buf, start, outLen, windowBits, sharedOut, sharedAt) {
  const posnSlots = windowBits === 20 ? 42 : windowBits === 21 ? 50 : windowBits << 1;
  const mainElements = NUM_CHARS + (posnSlots << 3);

  const br = new BitReader(buf, start);
  /*
   * The match window PERSISTS across resets — LZXC restarts the coder state,
   * not the history — so a block at the start of an interval may reference
   * bytes decoded in the interval before it. Decoding each interval into its
   * own buffer therefore fails on exactly those matches. The shared buffer is
   * the window.
   */
  const out = sharedOut ?? Buffer.alloc(outLen);
  const base = sharedOut ? sharedAt : 0;
  let o = base;
  const stop = base + outLen;

  const mainLens = new Uint8Array(mainElements);
  const lenLens = new Uint8Array(SECONDARY_LENGTHS);
  let mainTree = null, lenTree = null, alignTree = null;

  let R0 = 1, R1 = 1, R2 = 1;
  let blockType = 0, blockRemaining = 0;

  // Once per interval: whether x86 call targets were translated, and over what
  // size. Reading it is mandatory even when the answer is "no", which for this
  // file it always is.
  const intel = br.read(1);
  if (intel) br.read(32);

  while (o < stop) {
    if (blockRemaining === 0) {
      blockType = br.read(3);
      const hi = br.read(16), lo = br.read(8);
      blockRemaining = (hi << 8) | lo;

      if (blockType === BLOCK_ALIGNED) {
        const alignLens = new Uint8Array(ALIGNED_ELEMENTS);
        for (let i = 0; i < ALIGNED_ELEMENTS; i++) alignLens[i] = br.read(3);
        alignTree = buildTree(alignLens);
      }
      if (blockType === BLOCK_VERBATIM || blockType === BLOCK_ALIGNED) {
        readLengths(br, mainLens, 0, NUM_CHARS);
        readLengths(br, mainLens, NUM_CHARS, mainElements);
        mainTree = buildTree(mainLens);
        readLengths(br, lenLens, 0, SECONDARY_LENGTHS);
        lenTree = buildTree(lenLens);
      } else if (blockType === BLOCK_UNCOMPRESSED) {
        br.alignWord();
        // The three offsets restart from the stream, little-endian.
        let bp = br.p - (br.n >> 3);
        R0 = buf.readUInt32LE(bp); bp += 4;
        R1 = buf.readUInt32LE(bp); bp += 4;
        R2 = buf.readUInt32LE(bp); bp += 4;
        br.p = bp; br.bits = 0; br.n = 0;
      } else {
        throw new Error(`unknown LZX block type ${blockType}`);
      }
    }

    if (blockType === BLOCK_UNCOMPRESSED) {
      const take = Math.min(blockRemaining, stop - o);
      buf.copy(out, o, br.p, br.p + take);
      br.p += take;
      o += take;
      blockRemaining -= take;
      if (blockRemaining === 0 && (br.p & 1)) br.p++;   // pad to a word
      continue;
    }

    /*
     * Count what the block actually PRODUCES, not what was expected of it.
     *
     * A match near the end of a block writes its whole length, so the output
     * can pass the block's nominal end. Decrementing by a precomputed "take"
     * instead of by the bytes really emitted leaves the count short, the next
     * block header is then read from the middle of this block's data, and the
     * stream desynchronises.
     */
    while (blockRemaining > 0 && o < stop) {
      const sym = decodeSym(br, mainTree);
      if (sym < NUM_CHARS) {
        out[o++] = sym;
        blockRemaining--;
        if (o % FRAME_SIZE === 0) br.alignWord();
        continue;
      }
      const s = sym - NUM_CHARS;
      let matchLen = s & 7;
      const slot = s >> 3;
      if (matchLen === 7) matchLen = decodeSym(br, lenTree) + 7;
      matchLen += MIN_MATCH;

      let matchOff;
      if (slot === 0) { matchOff = R0; }
      else if (slot === 1) { matchOff = R1; R1 = R0; R0 = matchOff; }
      else if (slot === 2) { matchOff = R2; R2 = R0; R0 = matchOff; }
      else {
        const extra = EXTRA_BITS[slot];
        let verbatim;
        if (blockType === BLOCK_ALIGNED && extra >= 3) {
          verbatim = (br.read(extra - 3) << 3) | decodeSym(br, alignTree);
        } else {
          verbatim = br.read(extra);
        }
        matchOff = POSITION_BASE[slot] - 2 + verbatim;
        R2 = R1; R1 = R0; R0 = matchOff;
      }

      let src = o - matchOff;
      /*
       * A reset restarts the CODER, not the history: trees and the offset queue
       * go back to their initial state, but the 64 KB match window carries on.
       * So a match may legitimately reach into the previous interval's output —
       * bounded by the window, which is what makes it checkable. Beyond the
       * window it is a decode error, and must stay one: satisfying it from
       * further back splices text out of another topic, which reads as
       * plausible prose and is entirely fabricated.
       */
      if (src < 0 || o - src > (1 << windowBits)) {
        throw new Error(`match offset ${matchOff} outside the ${1 << windowBits}-byte window`);
      }
      for (let k = 0; k < matchLen && o < stop; k++) out[o++] = out[src++];
      blockRemaining -= matchLen;
      // The frame boundary is checked AFTER the copy: a match is the one thing
      // that can step over it, and the realignment must happen once the byte
      // count has actually crossed.
      if (o % FRAME_SIZE === 0) br.alignWord();
    }
  }

  // With a shared window the caller wants to know where the encoder resumed, so
  // it can be checked against the reset table; standalone callers want bytes.
  if (!sharedOut) return out;
  const bitsUsed = (br.p - start) * 8 - br.n;
  return start + 2 * Math.ceil(bitsUsed / 16);
}
