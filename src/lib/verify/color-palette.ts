import sharp from "sharp";

export interface LabColor {
  L: number; // 0 to 100
  a: number; // -128 to 127
  b: number; // -128 to 127
}

export interface RgbColor {
  r: number; // 0 to 255
  g: number; // 0 to 255
  b: number; // 0 to 255
}

/**
 * Convert standard sRGB (0-255) to CIE XYZ (D65 illuminant).
 */
export function rgbToXyz(rgb: RgbColor): { x: number; y: number; z: number } {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // D65 Standard Observer
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100;

  return { x, y, z };
}

/**
 * Convert CIE XYZ to CIE L*a*b* (CIELAB, D65 reference white).
 */
export function xyzToLab(xyz: { x: number; y: number; z: number }): LabColor {
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  let x = xyz.x / refX;
  let y = xyz.y / refY;
  let z = xyz.z / refZ;

  x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;

  const L = 116 * y - 16;
  const a = 500 * (x - y);
  const b = 200 * (y - z);

  return { L, a, b };
}

export function rgbToLab(rgb: RgbColor): LabColor {
  return xyzToLab(rgbToXyz(rgb));
}

export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Standard CIEDE2000 Color Difference Formula (ΔE00).
 * Reference: Sharma, G., Wu, W., & Dalal, E. N. (2005). The CIEDE2000 color-difference formula.
 */
export function ciede2000(c1: LabColor, c2: LabColor): number {
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.sqrt(c1.a * c1.a + c1.b * c1.b);
  const C2 = Math.sqrt(c2.a * c2.a + c2.b * c2.b);
  const Cbar = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));

  const a1Prime = (1 + G) * c1.a;
  const a2Prime = (1 + G) * c2.a;

  const C1Prime = Math.sqrt(a1Prime * a1Prime + c1.b * c1.b);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + c2.b * c2.b);

  const h1Prime = Math.atan2(c1.b, a1Prime) >= 0
    ? (Math.atan2(c1.b, a1Prime) * 180) / Math.PI
    : (Math.atan2(c1.b, a1Prime) * 180) / Math.PI + 360;

  const h2Prime = Math.atan2(c2.b, a2Prime) >= 0
    ? (Math.atan2(c2.b, a2Prime) * 180) / Math.PI
    : (Math.atan2(c2.b, a2Prime) * 180) / Math.PI + 360;

  const deltaLPrime = c2.L - c1.L;
  const deltaCPrime = C2Prime - C1Prime;

  let deltahPrime = 0;
  if (C1Prime * C2Prime !== 0) {
    if (Math.abs(h2Prime - h1Prime) <= 180) {
      deltahPrime = h2Prime - h1Prime;
    } else if (h2Prime - h1Prime > 180) {
      deltahPrime = h2Prime - h1Prime - 360;
    } else {
      deltahPrime = h2Prime - h1Prime + 360;
    }
  }

  const deltaHPrime = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin(((deltahPrime / 2) * Math.PI) / 180);

  const LbarPrime = (c1.L + c2.L) / 2;
  const CbarPrime = (C1Prime + C2Prime) / 2;

  let hbarPrime = 0;
  if (C1Prime * C2Prime !== 0) {
    if (Math.abs(h1Prime - h2Prime) <= 180) {
      hbarPrime = (h1Prime + h2Prime) / 2;
    } else if (h1Prime + h2Prime < 360) {
      hbarPrime = (h1Prime + h2Prime + 360) / 2;
    } else {
      hbarPrime = (h1Prime + h2Prime - 360) / 2;
    }
  }

  const T =
    1 -
    0.17 * Math.cos(((hbarPrime - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * hbarPrime) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hbarPrime + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hbarPrime - 63) * Math.PI) / 180);

  const deltaTheta = 30 * Math.exp(-Math.pow((hbarPrime - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(CbarPrime, 7) / (Math.pow(CbarPrime, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(LbarPrime - 50, 2)) / Math.sqrt(20 + Math.pow(LbarPrime - 50, 2));
  const SC = 1 + 0.045 * CbarPrime;
  const SH = 1 + 0.015 * CbarPrime * T;
  const RT = -Math.sin(((2 * deltaTheta) * Math.PI) / 180) * RC;

  const dE = Math.sqrt(
    Math.pow(deltaLPrime / (kL * SL), 2) +
    Math.pow(deltaCPrime / (kC * SC), 2) +
    Math.pow(deltaHPrime / (kH * SH), 2) +
    RT * (deltaCPrime / (kC * SC)) * (deltaHPrime / (kH * SH))
  );

  return dE;
}

/**
 * Standard Demo Warm Palette Swatches (Coral, Amber, Warm Sand, Terracotta).
 */
export const WARM_BRAND_PALETTE: LabColor[] = [
  rgbToLab(hexToRgb("#FF6B4A")), // Coral Sunset
  rgbToLab(hexToRgb("#FFAE33")), // Warm Amber Gold
  rgbToLab(hexToRgb("#E8503A")), // Terracotta
  rgbToLab(hexToRgb("#FFF4E6")), // Warm Cream / Ivory
  rgbToLab(hexToRgb("#D97706")), // Dark Amber
];

/**
 * Extract dominant colors from sanitized image buffer using sharp quantization,
 * and compute minimal CIEDE2000 distance to target brand palette.
 * Calibrated threshold: minDeltaE <= 16.0 considered compatible.
 */
export async function evaluatePaletteInCode(
  imageBuffer: Buffer,
  palette: LabColor[] = WARM_BRAND_PALETTE,
  thresholdDeltaE = 16.0
): Promise<{ matches: boolean; minDistance: number; dominantHex: string }> {
  // Downsample to 32x32 to quickly capture aggregate dominant pixels, removing alpha for consistent 3-channel RGB
  const { data, info } = await sharp(imageBuffer)
    .resize(32, 32, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  const pixelCount = info.width * info.height;

  for (let i = 0; i < data.length; i += 3) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
  }

  const avgRgb: RgbColor = {
    r: Math.round(totalR / pixelCount),
    g: Math.round(totalG / pixelCount),
    b: Math.round(totalB / pixelCount),
  };

  const dominantHex = `#${((1 << 24) + (avgRgb.r << 16) + (avgRgb.g << 8) + avgRgb.b).toString(16).slice(1)}`;
  const avgLab = rgbToLab(avgRgb);

  // Compute minimal CIEDE2000 distance against palette swatches
  let minDistance = Infinity;
  for (const swatch of palette) {
    const dist = ciede2000(avgLab, swatch);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  const matches = minDistance <= thresholdDeltaE;
  return {
    matches,
    minDistance: Number(minDistance.toFixed(2)),
    dominantHex,
  };
}
