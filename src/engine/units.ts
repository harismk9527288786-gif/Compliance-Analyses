/**
 * Deterministic Unit Normalization and Conversion Utility
 * Strictly typed for engineering and metallurgical calculations.
 */

export interface ParsedNumericValue {
  value: number;
  unit: string;
  originalText: string;
}

/**
 * Extracts a numeric value and its unit from a raw string.
 * Example: "312 MPa" -> { value: 312, unit: "MPa", originalText: "312 MPa" }
 */
export function parseEngineeringValue(raw: string | number | undefined | null): ParsedNumericValue | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') {
    return { value: raw, unit: '', originalText: String(raw) };
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Handle standard decimal numbers with optional signs and units
  // Matches e.g. "910 °C", "312.5 MPa", "29%", "<0.015", ">= 250"
  const match = str.match(/^([<>]=?|\b)?\s*([+-]?\d+(?:\.\d+)?)\s*([°a-zA-Z/%³²\-_0-9]+)?/);
  if (!match) {
    const numOnly = parseFloat(str.replace(/[^0-9.-]/g, ''));
    if (!isNaN(numOnly)) {
      return { value: numOnly, unit: '', originalText: str };
    }
    return null;
  }

  const numVal = parseFloat(match[2]);
  if (isNaN(numVal)) return null;

  let unit = (match[3] || '').trim();
  return {
    value: numVal,
    unit: normalizeUnitString(unit),
    originalText: str,
  };
}

/**
 * Normalizes unit string representations to standard forms
 */
export function normalizeUnitString(unit: string): string {
  const clean = unit.replace(/\s+/g, '').toUpperCase();
  if (clean === '°C' || clean === 'C' || clean === 'DEG C' || clean === 'DEGC' || clean === 'CELSIUS') return '°C';
  if (clean === '°F' || clean === 'F' || clean === 'DEG F' || clean === 'DEGF' || clean === 'FAHRENHEIT') return '°F';
  if (clean === 'MPA' || clean === 'N/MM2' || clean === 'N/MM²') return 'MPa';
  if (clean === 'KSI') return 'ksi';
  if (clean === 'PSI') return 'psi';
  if (clean === '%' || clean === 'PERCENT' || clean === 'PCT') return '%';
  if (clean === 'HBW' || clean === 'HB' || clean === 'BHN') return 'HBW';
  if (clean === 'HRC') return 'HRC';
  if (clean === 'HRB') return 'HRB';
  if (clean === 'HV' || clean === 'VICKERS') return 'HV';
  if (clean === 'J' || clean === 'JOULE' || clean === 'JOULES') return 'J';
  if (clean === 'FT-LB' || clean === 'FT-LBS' || clean === 'FTLBS') return 'ft-lbs';
  if (clean === 'MM') return 'mm';
  if (clean === 'INCH' || clean === 'IN' || clean === 'INCHES') return 'in';
  return unit;
}

/**
 * Converts a numeric value from sourceUnit to targetUnit
 */
export function convertValue(val: number, sourceUnit: string, targetUnit: string): number {
  const src = normalizeUnitString(sourceUnit);
  const tgt = normalizeUnitString(targetUnit);

  if (src === tgt || !src || !tgt) return val;

  // Temperature
  if (src === '°F' && tgt === '°C') {
    return (val - 32) * (5 / 9);
  }
  if (src === '°C' && tgt === '°F') {
    return val * (9 / 5) + 32;
  }

  // Stress / Strength
  if (src === 'ksi' && tgt === 'MPa') {
    return val * 6.89476;
  }
  if (src === 'MPa' && tgt === 'ksi') {
    return val / 6.89476;
  }
  if (src === 'psi' && tgt === 'MPa') {
    return val * 0.00689476;
  }

  // Percentage (e.g. 0.30 fraction vs 30%)
  if (src === 'ratio' && tgt === '%') {
    return val * 100;
  }
  if (src === '%' && tgt === 'ratio') {
    return val / 100;
  }

  // Impact Energy
  if (src === 'ft-lbs' && tgt === 'J') {
    return val * 1.35582;
  }
  if (src === 'J' && tgt === 'ft-lbs') {
    return val / 1.35582;
  }

  return val;
}
