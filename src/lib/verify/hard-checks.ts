import sharp from "sharp";
import crypto from "crypto";

export interface CriterionCheckItem {
  id: string;
  kind: "MAGIC_BYTES" | "FILE_SIZE" | "DIMENSIONS" | "ANIMATION" | "METADATA_INSPECTION";
  pass: boolean;
  observed: string;
  expected: string;
  reason?: string;
}

export interface HardChecksEvaluation {
  allPassed: boolean;
  originalSha256: string;
  sanitizedSha256?: string;
  sanitizedBuffer?: Buffer;
  metadataInstructionDetected: boolean;
  metadataSnippets: string[];
  checks: CriterionCheckItem[];
}

export const HARD_CHECK_CAPS = {
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,      // 10 MB absolute hard ceiling
  STANDARD_MAX_BYTES: 2 * 1024 * 1024,     // 2 MB = 2,097,152 bytes
  TARGET_WIDTH: 1080,
  TARGET_HEIGHT: 1080,
  MAX_PIXELS: 5000000,                     // Stop decompression bombs
};

const INSTRUCTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?(criteria|instructions|rules)/i,
  /approve\s+(this\s+)?(payment|payout|\$|\b)/i,
  /system\s*:/i,
  /override\s+(policy|guard|safety)/i,
  /return\s+(1\.0|100%|confidence)/i,
  /payout\s+to\s+/i,
  /attacker@/i,
];

/**
 * Scan PNG chunks for tEXt, zTXt, iTXt metadata strings.
 */
function extractPngTextChunks(buffer: Buffer): string[] {
  const snippets: string[] = [];
  let pos = 8; // skip 8-byte PNG signature

  while (pos < buffer.length - 8) {
    const length = buffer.readUInt32BE(pos);
    const chunkType = buffer.toString("ascii", pos + 4, pos + 8);
    const dataStart = pos + 8;
    const dataEnd = dataStart + length;

    if (dataEnd > buffer.length) break;

    if (chunkType === "tEXt" || chunkType === "zTXt" || chunkType === "iTXt") {
      const chunkData = buffer.slice(dataStart, dataEnd);
      // Clean readable ascii / utf-8 text
      const text = chunkData.toString("utf8").replace(/\0/g, " ");
      snippets.push(text);
    }

    pos = dataEnd + 4; // skip 4-byte CRC
  }

  return snippets;
}

/**
 * Detects whether buffer is an Animated PNG (APNG) by scanning for acTL chunk.
 */
function hasApngAnimationChunk(buffer: Buffer): boolean {
  let pos = 8;
  while (pos < buffer.length - 8) {
    const length = buffer.readUInt32BE(pos);
    const chunkType = buffer.toString("ascii", pos + 4, pos + 8);
    if (chunkType === "acTL") {
      return true;
    }
    pos += 8 + length + 4;
  }
  return false;
}

/**
 * Detect real MIME type from initial magic bytes.
 */
function detectMagicType(buffer: Buffer): { mime: string; name: string } {
  if (buffer.length < 8) return { mime: "unknown", name: "unknown" };

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", name: "PNG" };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", name: "JPEG" };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { mime: "image/gif", name: "GIF" };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", name: "WEBP" };
  }

  return { mime: "application/octet-stream", name: "Unknown" };
}

/**
 * Executes pure deterministic hard checks on ORIGINAL upload bytes.
 * HARD PRINCIPLE: The LLM can never override a failed hard check.
 * If a hard check fails, LLM execution is skipped and outcome is REJECT.
 */
export async function runHardChecks(
  originalBytes: Buffer,
  options?: {
    maxBytes?: number;
    targetWidth?: number;
    targetHeight?: number;
  }
): Promise<HardChecksEvaluation> {
  const maxBytes = options?.maxBytes ?? HARD_CHECK_CAPS.STANDARD_MAX_BYTES;
  const targetWidth = options?.targetWidth ?? HARD_CHECK_CAPS.TARGET_WIDTH;
  const targetHeight = options?.targetHeight ?? HARD_CHECK_CAPS.TARGET_HEIGHT;

  const originalSha256 = crypto.createHash("sha256").update(originalBytes).digest("hex");
  const checks: CriterionCheckItem[] = [];

  // 1. Hard upload cap ceiling check (10 MB)
  if (originalBytes.length > HARD_CHECK_CAPS.MAX_UPLOAD_BYTES) {
    return {
      allPassed: false,
      originalSha256,
      metadataInstructionDetected: false,
      metadataSnippets: [],
      checks: [
        {
          id: "HC_UPLOAD_CEILING",
          kind: "FILE_SIZE",
          pass: false,
          observed: `${originalBytes.length} bytes`,
          expected: `<= ${HARD_CHECK_CAPS.MAX_UPLOAD_BYTES} bytes`,
          reason: "Payload exceeds 10 MB hard system upload cap",
        },
      ],
    };
  }

  // 2. Real type detection from magic bytes
  const magic = detectMagicType(originalBytes);
  const isPng = magic.mime === "image/png";
  checks.push({
    id: "HC_MAGIC_BYTES_PNG",
    kind: "MAGIC_BYTES",
    pass: isPng,
    observed: magic.name,
    expected: "PNG (image/png)",
    reason: isPng ? "Valid PNG magic bytes detected" : `Invalid file type: expected PNG, observed ${magic.name}`,
  });

  // 3. File size limit boundary check (2 MB = 2,097,152 bytes)
  const withinSize = originalBytes.length <= maxBytes;
  checks.push({
    id: "HC_FILE_SIZE_LIMIT",
    kind: "FILE_SIZE",
    pass: withinSize,
    observed: `${originalBytes.length} bytes`,
    expected: `<= ${maxBytes} bytes (${(maxBytes / (1024 * 1024)).toFixed(0)} MB)`,
    reason: withinSize
      ? `File size is within ${maxBytes} bytes limit`
      : `File size ${originalBytes.length} bytes exceeds ${maxBytes} bytes limit by ${originalBytes.length - maxBytes} bytes`,
  });

  // 4. Reject Animated PNG (APNG)
  let isAnimated = false;
  if (isPng) {
    isAnimated = hasApngAnimationChunk(originalBytes);
  }
  checks.push({
    id: "HC_REJECT_ANIMATION",
    kind: "ANIMATION",
    pass: !isAnimated,
    observed: isAnimated ? "Animated PNG (acTL chunk detected)" : "Single-frame static image",
    expected: "Static single-frame PNG",
    reason: isAnimated ? "Multi-frame animated PNGs are forbidden" : "Static image confirmed",
  });

  // 5. Dimension & Decompression Bomb Protection via Sharp
  let dimensionsValid = false;
  let observedDims = "N/A";
  if (isPng && !isAnimated) {
    try {
      const meta = await sharp(originalBytes, {
        limitInputPixels: HARD_CHECK_CAPS.MAX_PIXELS,
      }).metadata();

      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      observedDims = `${w}x${h}px`;

      dimensionsValid = w === targetWidth && h === targetHeight;
      checks.push({
        id: "HC_DIMENSIONS_EXACT",
        kind: "DIMENSIONS",
        pass: dimensionsValid,
        observed: observedDims,
        expected: `${targetWidth}x${targetHeight}px`,
        reason: dimensionsValid
          ? `Exact dimensions verified: ${targetWidth}x${targetHeight}`
          : `Dimensions mismatch: expected ${targetWidth}x${targetHeight}, observed ${observedDims}`,
      });
    } catch (err: any) {
      checks.push({
        id: "HC_DIMENSIONS_EXACT",
        kind: "DIMENSIONS",
        pass: false,
        observed: "Parse Failure",
        expected: `${targetWidth}x${targetHeight}px`,
        reason: `Decompression or parsing failed: ${err.message}`,
      });
    }
  } else {
    checks.push({
      id: "HC_DIMENSIONS_EXACT",
      kind: "DIMENSIONS",
      pass: false,
      observed: "Skipped (Invalid Container)",
      expected: `${targetWidth}x${targetHeight}px`,
      reason: "Could not decode image header for dimensions",
    });
  }

  // 6. Metadata inspection (EXIF, XMP, PNG text chunks) for prompt injection
  const metadataSnippets = isPng ? extractPngTextChunks(originalBytes) : [];
  let metadataInstructionDetected = false;

  for (const snippet of metadataSnippets) {
    for (const pattern of INSTRUCTION_PATTERNS) {
      if (pattern.test(snippet)) {
        metadataInstructionDetected = true;
        break;
      }
    }
    if (metadataInstructionDetected) break;
  }

  checks.push({
    id: "HC_METADATA_INSPECTION",
    kind: "METADATA_INSPECTION",
    pass: !metadataInstructionDetected,
    observed: metadataInstructionDetected
      ? `Suspicious instruction-like text in chunk: "${metadataSnippets.find((s) => INSTRUCTION_PATTERNS.some((p) => p.test(s)))?.slice(0, 80)}..."`
      : `${metadataSnippets.length} metadata chunk(s) scanned, clean`,
    expected: "No prompt injection or instructions in metadata chunks",
    reason: metadataInstructionDetected
      ? "Adversarial prompt injection attempt detected inside image metadata chunk"
      : "No adversarial instructions found in metadata",
  });

  const allPassed = checks.every((c) => c.pass);

  // 7. Sanitization: Strip all metadata chunks, re-encode clean PNG
  let sanitizedBuffer: Buffer | undefined;
  let sanitizedSha256: string | undefined;

  if (isPng && !isAnimated && dimensionsValid) {
    try {
      sanitizedBuffer = await sharp(originalBytes)
        // Sharp strips all EXIF, XMP, IPTC, ICC, and text chunks by default (unless withMetadata() is passed)
        .png({ compressionLevel: 9 })
        .toBuffer();
      sanitizedSha256 = crypto.createHash("sha256").update(sanitizedBuffer).digest("hex");
    } catch (err) {
      console.error("[HardChecks] Sanitization re-encoding error:", err);
    }
  }

  return {
    allPassed,
    originalSha256,
    sanitizedSha256,
    sanitizedBuffer,
    metadataInstructionDetected,
    metadataSnippets,
    checks,
  };
}
