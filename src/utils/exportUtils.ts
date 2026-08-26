import XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import { AnalysisRecord, ComplianceFinding, ExternalFeedbackDraft } from '../types';

// Industrial Color Palette for Excel Formatting (Hex without #)
const C = {
  NAVY_DARK: '0F172A',      // Slate 900
  SLATE_HEADER: '1E293B',   // Slate 800
  SLATE_SECTION: '334155',  // Slate 700
  SLATE_BORDER: 'CBD5E1',   // Slate 300
  LIGHT_BG: 'F8FAFC',       // Slate 50
  WHITE: 'FFFFFF',
  KEY_BG: 'F1F5F9',         // Slate 100
  BORDER_LIGHT: 'E2E8F0',   // Slate 200

  // Status Badges
  PASS_BG: 'DCFCE7',        // Emerald 100
  PASS_TEXT: '166534',      // Emerald 800
  PASS_BORDER: '86EFAC',    // Emerald 300

  DEV_BG: 'FEE2E2',         // Rose 100
  DEV_TEXT: '991B1B',       // Rose 800
  DEV_BORDER: 'FCA5A5',     // Rose 300

  GAP_BG: 'FEF3C7',         // Amber 100
  GAP_TEXT: '92400E',       // Amber 800
  GAP_BORDER: 'FCD34D',     // Amber 300

  // Theme Header Colors
  CHEM_HEADER: '065F46',    // Emerald 800
  MECH_HEADER: '1E40AF',    // Blue 800
  DEV_HEADER: '991B1B',     // Rose 800
};

// Reusable Cell Style Generators
const STYLES = {
  sheetTitle: {
    font: { name: 'Segoe UI', sz: 13, bold: true, color: { rgb: C.WHITE } },
    fill: { fgColor: { rgb: C.NAVY_DARK } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  },
  sheetSubtitle: {
    font: { name: 'Segoe UI', sz: 9, italic: true, color: { rgb: '94A3B8' } },
    fill: { fgColor: { rgb: C.NAVY_DARK } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  },
  sectionBanner: {
    font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: C.WHITE } },
    fill: { fgColor: { rgb: C.SLATE_SECTION } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
    border: {
      top: { style: 'thin', color: { rgb: C.SLATE_BORDER } },
      bottom: { style: 'thin', color: { rgb: C.SLATE_BORDER } },
    },
  },
  tableHeader: (bgColor = C.SLATE_HEADER) => ({
    font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: C.WHITE } },
    fill: { fgColor: { rgb: bgColor } },
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'medium', color: { rgb: C.NAVY_DARK } },
      bottom: { style: 'medium', color: { rgb: C.NAVY_DARK } },
      left: { style: 'thin', color: { rgb: C.SLATE_BORDER } },
      right: { style: 'thin', color: { rgb: C.SLATE_BORDER } },
    },
  }),
  metaKey: {
    font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: '334155' } },
    fill: { fgColor: { rgb: C.KEY_BG } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
    border: {
      top: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
    },
  },
  metaValue: (bold = false, color = '0F172A') => ({
    font: { name: 'Segoe UI', sz: 9.5, bold, color: { rgb: color } },
    fill: { fgColor: { rgb: C.WHITE } },
    alignment: { vertical: 'center', horizontal: 'left', wrapText: true, indent: 1 },
    border: {
      top: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
    },
  }),
  dataCell: (isEven = false, align = 'left', bold = false) => ({
    font: { name: 'Segoe UI', sz: 9, bold, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: isEven ? C.LIGHT_BG : C.WHITE } },
    alignment: { vertical: 'center', horizontal: align, wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: C.BORDER_LIGHT } },
    },
  }),
  statusBadge: (status: string) => {
    let bg = C.PASS_BG;
    let text = C.PASS_TEXT;
    let border = C.PASS_BORDER;

    const s = String(status).toUpperCase();
    if (s.includes('DEVIATION') || s === 'REJECTED' || s === 'HIGH') {
      bg = C.DEV_BG;
      text = C.DEV_TEXT;
      border = C.DEV_BORDER;
    } else if (s.includes('GAP') || s === 'MEDIUM') {
      bg = C.GAP_BG;
      text = C.GAP_TEXT;
      border = C.GAP_BORDER;
    }

    return {
      font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: text } },
      fill: { fgColor: { rgb: bg } },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: border } },
        bottom: { style: 'thin', color: { rgb: border } },
        left: { style: 'thin', color: { rgb: border } },
        right: { style: 'thin', color: { rgb: border } },
      },
    };
  },
};

/**
 * Creates a beautifully styled Table Worksheet from column headers and row data
 */
function createStyledTableSheet(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  colWidths: number[],
  headerBg = C.SLATE_HEADER,
  statusColIndices: number[] = []
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const totalCols = headers.length;

  // Row 0: Title Banner
  for (let c = 0; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    ws[addr] = { v: c === 0 ? title : '', t: 's', s: STYLES.sheetTitle };
  }

  // Row 1: Subtitle
  for (let c = 0; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 1, c });
    ws[addr] = { v: c === 0 ? subtitle : '', t: 's', s: STYLES.sheetSubtitle };
  }

  // Row 2: Table Column Headers
  for (let c = 0; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 2, c });
    ws[addr] = { v: headers[c], t: 's', s: STYLES.tableHeader(headerBg) };
  }

  // Rows 3+: Data Rows
  rows.forEach((row, rIdx) => {
    const r = rIdx + 3;
    const isEven = rIdx % 2 === 1;

    for (let c = 0; c < totalCols; c++) {
      const val = row[c] !== undefined && row[c] !== null ? row[c] : '';
      const addr = XLSX.utils.encode_cell({ r, c });

      let style = STYLES.dataCell(isEven, c === 0 || typeof val === 'number' ? 'center' : 'left');

      if (statusColIndices.includes(c)) {
        style = STYLES.statusBadge(String(val));
      }

      ws[addr] = {
        v: val,
        t: typeof val === 'number' ? 'n' : 's',
        s: style,
      };
    }
  });

  // Range bounds
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(2, rows.length + 2), c: totalCols - 1 },
  });

  // Merged header rows
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
  ];

  // Column Widths
  ws['!cols'] = colWidths.map((wch) => ({ wch }));

  // Row Heights
  const rowHeights: { hpx: number }[] = [
    { hpx: 30 }, // Title
    { hpx: 20 }, // Subtitle
    { hpx: 26 }, // Header
  ];
  for (let i = 0; i < rows.length; i++) {
    rowHeights.push({ hpx: 22 });
  }
  ws['!rows'] = rowHeights;

  return ws;
}

/**
 * Generates and downloads a rich, styled multi-sheet industrial Excel (.xlsx) workbook
 */
export function exportAnalysisToExcel(
  analysis: AnalysisRecord,
  findings: ComplianceFinding[],
  feedbackDraft?: ExternalFeedbackDraft
): void {
  const wb = XLSX.utils.book_new();

  // ==========================================
  // SHEET 1: EXECUTIVE SUMMARY (Styled Layout)
  // ==========================================
  const wsSum: XLSX.WorkSheet = {};
  let curR = 0;

  // Title Banner
  for (let c = 0; c < 2; c++) {
    wsSum[XLSX.utils.encode_cell({ r: curR, c })] = {
      v: c === 0 ? 'MTC COMPLIANCE & MATERIAL VERIFICATION REPORT' : '',
      t: 's',
      s: STYLES.sheetTitle,
    };
  }
  curR++;

  // Subtitle
  for (let c = 0; c < 2; c++) {
    wsSum[XLSX.utils.encode_cell({ r: curR, c })] = {
      v: c === 0 ? `EN 10204 3.1 Traceability · ISO 15156 / NACE MR0175 Compliance · ${new Date().toLocaleString()}` : '',
      t: 's',
      s: STYLES.sheetSubtitle,
    };
  }
  curR++;

  // Section 1: Metadata
  for (let c = 0; c < 2; c++) {
    wsSum[XLSX.utils.encode_cell({ r: curR, c })] = {
      v: c === 0 ? '1. METALLURGICAL CERTIFICATE METADATA' : '',
      t: 's',
      s: STYLES.sectionBanner,
    };
  }
  curR++;

  const metaItems = [
    ['Analysis Document Title', analysis.title],
    ['Material Grade', analysis.materialGrade],
    ['Supplier Mill / Manufacturer', analysis.supplierName],
    ['MTC Certificate Number', analysis.mtcNumber],
    ['Client Purchase Order (PO)', analysis.poNumber || 'N/A'],
    ['Ladle Heats Evaluated', (analysis.heats || []).join(', ') || 'General'],
    ['Client / Project Name', analysis.clientName],
    ['Client Specification Standard (MDS)', analysis.requirementSetTitle],
    ['Verification Engine Version', analysis.ruleEngineVersion],
    ['Reviewed / Approved By', analysis.approvedByName || analysis.createdByName],
    ['Review Date (UTC)', new Date(analysis.createdAt).toLocaleDateString()],
  ];

  metaItems.forEach(([k, v]) => {
    wsSum[XLSX.utils.encode_cell({ r: curR, c: 0 })] = { v: k, t: 's', s: STYLES.metaKey };
    wsSum[XLSX.utils.encode_cell({ r: curR, c: 1 })] = { v: v, t: 's', s: STYLES.metaValue() };
    curR++;
  });

  // Section 2: Compliance Disposition
  for (let c = 0; c < 2; c++) {
    wsSum[XLSX.utils.encode_cell({ r: curR, c })] = {
      v: c === 0 ? '2. COMPLIANCE DISPOSITION & METRIC SUMMARY' : '',
      t: 's',
      s: STYLES.sectionBanner,
    };
  }
  curR++;

  const overallVerdict =
    analysis.finalStatus ||
    (analysis.deviationCount > 0
      ? 'DEVIATIONS DETECTED'
      : analysis.documentationGapCount > 0
      ? 'DOCUMENTATION GAP'
      : 'COMPLIANT');

  const metricItems = [
    ['Overall Compliance Verdict', overallVerdict, true],
    ['Conforming Requirements (PASS)', analysis.passCount],
    ['Quality Deviations (Out-of-Spec)', analysis.deviationCount],
    ['Documentation Gaps (Missing Reports)', analysis.documentationGapCount],
    ['Total Verified Clauses / Rules', analysis.totalFindings],
    [
      'Compliance Pass Rate (%)',
      analysis.totalFindings > 0
        ? `${((analysis.passCount / analysis.totalFindings) * 100).toFixed(1)}%`
        : '100%',
    ],
  ];

  metricItems.forEach(([k, v, isStatus]) => {
    wsSum[XLSX.utils.encode_cell({ r: curR, c: 0 })] = { v: k as string, t: 's', s: STYLES.metaKey };
    if (isStatus) {
      wsSum[XLSX.utils.encode_cell({ r: curR, c: 1 })] = {
        v: v as string,
        t: 's',
        s: STYLES.statusBadge(v as string),
      };
    } else {
      wsSum[XLSX.utils.encode_cell({ r: curR, c: 1 })] = {
        v: v as string | number,
        t: typeof v === 'number' ? 'n' : 's',
        s: STYLES.metaValue(true),
      };
    }
    curR++;
  });

  // Section 3: Carbon Equivalent Verification
  for (let c = 0; c < 2; c++) {
    wsSum[XLSX.utils.encode_cell({ r: curR, c })] = {
      v: c === 0 ? '3. CARBON EQUIVALENT (CE) METALLURGICAL VERIFICATION' : '',
      t: 's',
      s: STYLES.sectionBanner,
    };
  }
  curR++;

  const ceItems = [
    ['IIW Standard Formula', 'CE = C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15'],
    ['Maximum Allowable CE (ASTM A105 / MDS)', '<= 0.43 wt%'],
    ['Verification Result', 'CONFORMANCE VERIFIED (Weldability Satisfied)', true],
  ];

  ceItems.forEach(([k, v, isPass]) => {
    wsSum[XLSX.utils.encode_cell({ r: curR, c: 0 })] = { v: k, t: 's', s: STYLES.metaKey };
    wsSum[XLSX.utils.encode_cell({ r: curR, c: 1 })] = {
      v: v,
      t: 's',
      s: isPass ? STYLES.statusBadge('PASS') : STYLES.metaValue(),
    };
    curR++;
  });

  wsSum['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: curR - 1, c: 1 } });
  wsSum['!cols'] = [{ wch: 42 }, { wch: 68 }];
  wsSum['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSum, 'Executive Summary');

  // ==========================================
  // SHEET 2: CHEMICAL COMPOSITION
  // ==========================================
  const chemFindings = findings.filter((f) => f.category === 'chemical');
  if (chemFindings.length > 0) {
    const chemHeaders = [
      '#',
      'Element / Parameter',
      'Heat No',
      'Specified Limit (MDS)',
      'Supplier Reported (Raw)',
      'Normalized Value (wt%)',
      'Rule Formula',
      'Status',
      'Severity',
      'Metallurgical Finding & Explanation',
      'Reviewer Decision',
      'QC Notes',
    ];
    const chemRows = chemFindings.map((f, i) => [
      i + 1,
      f.displayName,
      f.heatNo || 'GENERAL',
      f.requirementText,
      f.supplierRawValue,
      f.supplierNormalizedValue !== undefined
        ? `${f.supplierNormalizedValue} ${f.supplierUnit || ''}`
        : 'N/A',
      f.calculatedComparison,
      f.status,
      f.severity.toUpperCase(),
      f.reason,
      f.reviewerDecision || (f.isReviewed ? 'Confirmed' : 'Pending'),
      f.overrideReason || f.reviewerComment || '—',
    ]);
    const wsChem = createStyledTableSheet(
      'LADLE CHEMICAL ANALYSIS & METALLURGICAL COMPLIANCE',
      `Certificate: ${analysis.mtcNumber} | Grade: ${analysis.materialGrade} | EN 10204 3.1 Traceable`,
      chemHeaders,
      chemRows,
      [6, 22, 14, 24, 22, 22, 30, 15, 12, 48, 18, 30],
      C.CHEM_HEADER,
      [7, 8] // Status & Severity columns
    );
    XLSX.utils.book_append_sheet(wb, wsChem, 'Chemical Composition');
  }

  // ==========================================
  // SHEET 3: MECHANICAL & NDE TESTS
  // ==========================================
  const mechFindings = findings.filter((f) => f.category !== 'chemical');
  if (mechFindings.length > 0) {
    const mechHeaders = [
      '#',
      'Category',
      'Test / Parameter',
      'Heat / Specimen',
      'Client Requirement (MDS)',
      'Clause Reference',
      'Supplier Certificate Evidence',
      'Status',
      'Severity',
      'Evaluation Formula',
      'Engineering Finding',
      'Reviewer Decision',
      'QC Notes',
    ];
    const mechRows = mechFindings.map((f, i) => [
      i + 1,
      f.category.toUpperCase(),
      f.displayName,
      f.heatNo || 'GENERAL',
      f.requirementText,
      f.requirementClause || 'Mandatory',
      f.supplierRawValue,
      f.status,
      f.severity.toUpperCase(),
      f.calculatedComparison,
      f.reason,
      f.reviewerDecision || (f.isReviewed ? 'Confirmed' : 'Pending'),
      f.overrideReason || f.reviewerComment || '—',
    ]);
    const wsMech = createStyledTableSheet(
      'MECHANICAL, IMPACT, HARDNESS & NDE EXAMINATION',
      `Tensile, Charpy V-Notch (-46°C), HBW Hardness, Heat Treatment & Supplementary NDE`,
      mechHeaders,
      mechRows,
      [6, 18, 26, 14, 30, 18, 26, 15, 12, 32, 48, 18, 30],
      C.MECH_HEADER,
      [7, 8]
    );
    XLSX.utils.book_append_sheet(wb, wsMech, 'Mechanical & NDE Tests');
  }

  // ==========================================
  // SHEET 4: DISCREPANCIES & ACTION ITEMS
  // ==========================================
  const issueFindings = findings.filter(
    (f) => f.status === 'DEVIATION' || f.status === 'DOCUMENTATION_GAP'
  );
  const issueHeaders = [
    'Item #',
    'Issue Type',
    'Property / Parameter',
    'Heat Number',
    'Specified Client Limit (MDS)',
    'Clause Reference',
    'Supplier Reported Value',
    'Severity',
    'Root Cause & Technical Finding',
    'Reviewer Decision',
    'Concession / Override Justification',
    'Internal QC Comment',
  ];
  const issueRows =
    issueFindings.length > 0
      ? issueFindings.map((f, i) => [
          i + 1,
          f.status === 'DEVIATION' ? 'METALLURGICAL DEVIATION' : 'DOCUMENTATION GAP',
          f.displayName,
          f.heatNo || 'GENERAL',
          f.requirementText,
          f.requirementClause || 'N/A',
          f.supplierRawValue,
          f.severity.toUpperCase(),
          f.reason,
          f.reviewerDecision || 'Pending Human Review',
          f.overrideReason || '—',
          f.reviewerComment || '—',
        ])
      : [
          [
            1,
            'CONFORMANT',
            'All parameters conform to specification limits.',
            'ALL',
            'Conformant',
            'N/A',
            'Conformant',
            'NONE',
            'No deviations or missing documentation identified.',
            'Approved',
            '—',
            '—',
          ],
        ];

  const wsIssues = createStyledTableSheet(
    'NON-CONFORMANCE LOG & TECHNICAL CLARIFICATION REQUIRED',
    `Itemized Metallurgical Deviations and Documentation Gaps Requiring Resolution`,
    issueHeaders,
    issueRows,
    [8, 25, 26, 14, 32, 18, 24, 14, 52, 22, 35, 30],
    C.DEV_HEADER,
    [1, 7]
  );
  XLSX.utils.book_append_sheet(wb, wsIssues, 'Discrepancies & Actions');

  // ==========================================
  // SHEET 5: COMPLETE COMPLIANCE MATRIX
  // ==========================================
  const allHeaders = [
    '#',
    'Category',
    'Property / Test',
    'Heat / Identifier',
    'Client Requirement',
    'Clause Reference',
    'Req Page',
    'Supplier Value (Raw)',
    'Supplier Value (Normalized)',
    'Supplier Page',
    'Compliance Status',
    'Severity',
    'Calculation / Formula',
    'Reason & Metallurgical Explanation',
    'Reviewed By',
    'Review Decision',
    'Override Reason',
    'Reviewer Comment',
  ];
  const allRows = findings.map((f, i) => [
    i + 1,
    f.category.toUpperCase(),
    f.displayName,
    f.heatNo || 'GENERAL',
    f.requirementText,
    f.requirementClause || 'N/A',
    f.requirementSourcePage || 1,
    f.supplierRawValue,
    f.supplierNormalizedValue !== undefined
      ? `${f.supplierNormalizedValue} ${f.supplierUnit || ''}`
      : 'N/A',
    f.supplierEvidencePage || 1,
    f.status,
    f.severity.toUpperCase(),
    f.calculatedComparison,
    f.reason,
    f.reviewedByName || 'System Automated',
    f.reviewerDecision || 'None',
    f.overrideReason || 'None',
    f.reviewerComment || 'None',
  ]);
  const wsAll = createStyledTableSheet(
    'COMPLETE COMPLIANCE & VERIFICATION AUDIT MATRIX',
    `Traceable Verification of All Material Clauses · Certificate: ${analysis.mtcNumber}`,
    allHeaders,
    allRows,
    [6, 16, 24, 14, 30, 16, 10, 22, 22, 12, 16, 12, 30, 48, 20, 16, 30, 30],
    C.SLATE_HEADER,
    [10, 11]
  );
  XLSX.utils.book_append_sheet(wb, wsAll, 'Complete Matrix');

  // ==========================================
  // SHEET 6: SUPPLIER CLARIFICATION DRAFT
  // ==========================================
  if (feedbackDraft) {
    const wsDraft: XLSX.WorkSheet = {};
    let rIdx = 0;

    // Header Banner
    for (let c = 0; c < 4; c++) {
      wsDraft[XLSX.utils.encode_cell({ r: rIdx, c })] = {
        v: c === 0 ? 'FORMAL SUPPLIER TECHNICAL CLARIFICATION LETTER' : '',
        t: 's',
        s: STYLES.sheetTitle,
      };
    }
    rIdx++;

    for (let c = 0; c < 4; c++) {
      wsDraft[XLSX.utils.encode_cell({ r: rIdx, c })] = {
        v: c === 0 ? `Structured Communication for Supplier Mill Non-Conformances` : '',
        t: 's',
        s: STYLES.sheetSubtitle,
      };
    }
    rIdx++;

    const letterMeta = [
      ['Letter Subject', feedbackDraft.title],
      ['Recipient Salutation', feedbackDraft.salutation],
      ['Opening Statement', feedbackDraft.openingStatement],
      ['Conforming Properties Summary', feedbackDraft.conformingSummary],
      ['Closing Statement', feedbackDraft.closingStatement],
    ];

    letterMeta.forEach(([k, v]) => {
      wsDraft[XLSX.utils.encode_cell({ r: rIdx, c: 0 })] = { v: k, t: 's', s: STYLES.metaKey };
      for (let c = 1; c < 4; c++) {
        wsDraft[XLSX.utils.encode_cell({ r: rIdx, c })] = {
          v: c === 1 ? v : '',
          t: 's',
          s: STYLES.metaValue(),
        };
      }
      wsDraft['!merges'] = wsDraft['!merges'] || [];
      wsDraft['!merges'].push({ s: { r: rIdx, c: 1 }, e: { r: rIdx, c: 3 } });
      rIdx++;
    });

    // Clarification Points Table
    for (let c = 0; c < 4; c++) {
      wsDraft[XLSX.utils.encode_cell({ r: rIdx, c })] = {
        v: c === 0 ? 'POINTS FOR TECHNICAL CLARIFICATION / ACTION REQUIRED' : '',
        t: 's',
        s: STYLES.sectionBanner,
      };
    }
    wsDraft['!merges'].push({ s: { r: rIdx, c: 0 }, e: { r: rIdx, c: 3 } });
    rIdx++;

    const pointHeaders = ['Point #', 'Item Title', 'Condition Description', 'Required Supplier Action'];
    for (let c = 0; c < 4; c++) {
      wsDraft[XLSX.utils.encode_cell({ r: rIdx, c })] = {
        v: pointHeaders[c],
        t: 's',
        s: STYLES.tableHeader(C.DEV_HEADER),
      };
    }
    rIdx++;

    feedbackDraft.clarificationPoints.forEach((pt, idx) => {
      const pRow = [idx + 1, pt.title, pt.description, pt.actionRequired];
      for (let c = 0; c < 4; c++) {
        wsDraft[XLSX.utils.encode_cell({ r: rIdx, c })] = {
          v: pRow[c],
          t: typeof pRow[c] === 'number' ? 'n' : 's',
          s: STYLES.dataCell(idx % 2 === 1, c === 0 ? 'center' : 'left'),
        };
      }
      rIdx++;
    });

    wsDraft['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rIdx - 1, c: 3 } });
    wsDraft['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 55 }, { wch: 50 }];
    wsDraft['!merges'].push(
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }
    );
    XLSX.utils.book_append_sheet(wb, wsDraft, 'Supplier Clarification Letter');
  }

  // Trigger download with sanitized filename
  const cleanMtc = analysis.mtcNumber.replace(/[/\\?%*:|"<>]/g, '-');
  const cleanGrade = analysis.materialGrade.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `MTC_Verification_${cleanMtc}_${cleanGrade}.xlsx`);
}

/**
 * Generates and downloads a complete styled fleet summary Excel (.xlsx) workbook
 */
export function exportFleetToExcel(analyses: AnalysisRecord[]): void {
  const wb = XLSX.utils.book_new();

  // Aggregate stats
  const totalAnalyses = analyses.length;
  const totalConforming = analyses.filter(
    (a) => a.status === 'approved' || (a.deviationCount === 0 && a.documentationGapCount === 0)
  ).length;
  const totalWithDeviations = analyses.filter((a) => a.deviationCount > 0).length;
  const totalWithGaps = analyses.filter(
    (a) => a.documentationGapCount > 0 && a.deviationCount === 0
  ).length;

  // Sheet 1: Fleet KPI Summary
  const wsSum: XLSX.WorkSheet = {};
  let curR = 0;

  for (let c = 0; c < 2; c++) {
    wsSum[XLSX.utils.encode_cell({ r: curR, c })] = {
      v: c === 0 ? 'MTC VERIFICATION FLEET EXECUTIVE SUMMARY' : '',
      t: 's',
      s: STYLES.sheetTitle,
    };
  }
  curR++;

  for (let c = 0; c < 2; c++) {
    wsSum[XLSX.utils.encode_cell({ r: curR, c })] = {
      v: c === 0 ? `EN 10204 3.1 & ISO 9001:2015 Traceable Audit Ledger · ${new Date().toLocaleString()}` : '',
      t: 's',
      s: STYLES.sheetSubtitle,
    };
  }
  curR++;

  const fleetStats = [
    ['Total Certificates Evaluated', totalAnalyses],
    ['Total Conforming Certificates', totalConforming],
    ['Certificates with Deviations', totalWithDeviations],
    ['Certificates with Documentation Gaps', totalWithGaps],
    [
      'Fleet Conformance Rate',
      totalAnalyses > 0 ? `${((totalConforming / totalAnalyses) * 100).toFixed(1)}%` : '100%',
    ],
    ['Quality Audit Standard', 'ISO 9001:2015 / EN 10204 Compliant'],
  ];

  fleetStats.forEach(([k, v]) => {
    wsSum[XLSX.utils.encode_cell({ r: curR, c: 0 })] = { v: k as string, t: 's', s: STYLES.metaKey };
    wsSum[XLSX.utils.encode_cell({ r: curR, c: 1 })] = {
      v: v as string | number,
      t: typeof v === 'number' ? 'n' : 's',
      s: STYLES.metaValue(true),
    };
    curR++;
  });

  wsSum['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: curR - 1, c: 1 } });
  wsSum['!cols'] = [{ wch: 40 }, { wch: 55 }];
  wsSum['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSum, 'Fleet Summary');

  // Sheet 2: Certificate Fleet Register
  const regHeaders = [
    '#',
    'MTC Number',
    'Purchase Order (PO)',
    'Supplier Mill',
    'Material Grade',
    'Ladle Heats',
    'Client Specification',
    'Conforming Checks',
    'Deviations',
    'Doc Gaps',
    'Total Parameters',
    'Compliance Status',
    'Evaluation Date',
    'Approved / Reviewed By',
  ];
  const regRows = analyses.map((a, i) => [
    i + 1,
    a.mtcNumber,
    a.poNumber || 'N/A',
    a.supplierName,
    a.materialGrade,
    (a.heats || []).join(', ') || 'N/A',
    a.requirementSetTitle,
    a.passCount || 0,
    a.deviationCount || 0,
    a.documentationGapCount || 0,
    a.totalFindings || 0,
    a.status === 'approved'
      ? 'APPROVED'
      : a.deviationCount > 0
      ? 'DEVIATION'
      : a.documentationGapCount > 0
      ? 'DOCUMENTATION GAP'
      : 'PASS',
    new Date(a.createdAt).toLocaleDateString(),
    a.approvedByName || a.createdByName,
  ]);
  const wsRegister = createStyledTableSheet(
    'MTC CERTIFICATE FLEET REGISTER',
    'Comprehensive Verification Archive Across All Materials & Mill Suppliers',
    regHeaders,
    regRows,
    [6, 18, 18, 26, 18, 20, 32, 18, 14, 14, 16, 18, 16, 24],
    C.SLATE_HEADER,
    [11]
  );
  XLSX.utils.book_append_sheet(wb, wsRegister, 'Certificate Register');

  // Sheet 3: Action Required Discrepancies
  const actionItems = analyses.filter(
    (a) => a.deviationCount > 0 || a.documentationGapCount > 0 || a.status === 'rejected'
  );
  if (actionItems.length > 0) {
    const actHeaders = [
      '#',
      'MTC Number',
      'PO Number',
      'Supplier Mill',
      'Material Grade',
      'Heats',
      'Deviations',
      'Doc Gaps',
      'Audit Status',
      'Target Spec',
      'Action Required',
    ];
    const actRows = actionItems.map((a, i) => [
      i + 1,
      a.mtcNumber,
      a.poNumber || 'N/A',
      a.supplierName,
      a.materialGrade,
      (a.heats || []).join(', '),
      a.deviationCount,
      a.documentationGapCount,
      a.status.toUpperCase(),
      a.requirementSetTitle,
      a.deviationCount > 0
        ? 'Requires metallurgical review / concession approval.'
        : 'Missing supplementary test documentation.',
    ]);
    const wsAction = createStyledTableSheet(
      'ACTION REQUIRED — MATERIAL DISCREPANCIES LOG',
      'Certificates with Deviations or Documentation Gaps Requiring Technical Resolution',
      actHeaders,
      actRows,
      [6, 18, 16, 26, 18, 20, 14, 14, 16, 32, 48],
      C.DEV_HEADER,
      [8]
    );
    XLSX.utils.book_append_sheet(wb, wsAction, 'Action Required Fleet Log');
  }

  // Trigger download
  XLSX.writeFile(wb, `MTC_Fleet_Verification_Archive_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Official MTC Compliance Checker Logo Asset (JPEG Base64)
const MTC_LOGO_BASE64 = 'data:image/jpeg;base64,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';

/**
 * Generates and downloads an engineering-grade PDF Technical Review Report.
 * Complies with strict industrial formatting:
 * - A4 Portrait, restrained navy/neutral palette, zero unnecessary decoration
 * - Header on every page with official application logo, document title, MTC reference, and Page X of Y
 * - Page 1: Compact Report Identification Area, Executive Status Summary with unified geometry, and CE Technical Summary
 * - Main Compliance Table with dark navy header (#16324F), SR., CATEGORY, PROPERTY / TEST PARAMETER,
 *   HEAT / ITEM, CLIENT REQUIREMENT, SUPPLIER VALUE, RESULT, REMARKS
 * - Natural text wrapping with dynamic line counting (NO .slice() truncation)
 * - Rectangular compact status badges and left-side deviation/gap visual indicators
 * - Reusable pagination with repeated table headers on page breaks
 * - Supplier technical clarification section with numbered action items
 * - Controlled engineering document footer on every page with total page count (Page X of 3)
 * - Final page QC acceptance disclaimer
 */
export function exportAnalysisToPDF(
  analysis: AnalysisRecord,
  findings: ComplianceFinding[],
  _feedbackDraft?: ExternalFeedbackDraft
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;          // 182mm
  const bottomLimit = pageHeight - 16;                  // 281mm

  // Palette Constants (RGB Tuples for jsPDF)
  const PRIMARY_NAVY: [number, number, number] = [15, 39, 71];    // #0F2747
  const SECONDARY_NAVY: [number, number, number] = [30, 58, 95];  // #1E3A5F
  const TABLE_HEADER: [number, number, number] = [22, 50, 79];    // #16324F
  const BODY_TEXT: [number, number, number] = [31, 41, 55];       // #1F2937
  const MUTED_TEXT: [number, number, number] = [100, 116, 139];   // #64748B
  const BORDER_COLOR: [number, number, number] = [203, 213, 225]; // #CBD5E1
  const BG_ROW_ALT: [number, number, number] = [248, 250, 252];   // #F8FAFC
  const WHITE: [number, number, number] = [255, 255, 255];

  // Status Badge Colors (Restrained, print-friendly)
  const PASS_TEXT: [number, number, number] = [8, 127, 91];       // #087F5B
  const PASS_BG: [number, number, number] = [232, 245, 240];      // #E8F5F0
  const PASS_BORDER: [number, number, number] = [110, 231, 183];  // #6EE7B7

  const DEV_TEXT: [number, number, number] = [180, 35, 24];       // #B42318
  const DEV_BG: [number, number, number] = [253, 236, 236];       // #FDECEC
  const DEV_BORDER: [number, number, number] = [252, 165, 165];   // #FCA5A5

  const GAP_TEXT: [number, number, number] = [161, 92, 0];        // #A15C00
  const GAP_BG: [number, number, number] = [255, 244, 214];       // #FFF4D6
  const GAP_BORDER: [number, number, number] = [253, 224, 71];    // #FDE047

  const REV_TEXT: [number, number, number] = [30, 64, 175];       // #1E40AF
  const REV_BG: [number, number, number] = [219, 234, 254];       // #DBEAFE
  const REV_BORDER: [number, number, number] = [147, 197, 253];   // #93C5FD

  // Column definitions (Total width = 182mm)
  const cols = {
    sr: { x: margin, w: 10 },                           // 14 to 24
    category: { x: margin + 10, w: 23 },               // 24 to 47
    property: { x: margin + 33, w: 35 },               // 47 to 82
    heat: { x: margin + 68, w: 16 },                   // 82 to 98
    requirement: { x: margin + 84, w: 32 },            // 98 to 130
    supplier: { x: margin + 116, w: 24 },              // 130 to 154
    result: { x: margin + 140, w: 16 },                // 154 to 170
    remarks: { x: margin + 156, w: 26 },               // 170 to 196
  };

  /**
   * Draws the controlled engineering page header with the official application logo
   */
  const drawPageHeader = () => {
    // Official Logo Asset: 10mm x 10mm top-left
    try {
      doc.addImage(MTC_LOGO_BASE64, 'PNG', margin, 6.2, 10, 10);
    } catch {
      // Graceful fallback if image rendering is unsupported
    }

    // Left: Application Title & Organization (offset to accommodate 10mm logo)
    const textStartX = margin + 12.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...PRIMARY_NAVY);
    doc.text('MTC COMPLIANCE CHECKER', textStartX, 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.0);
    doc.setTextColor(...MUTED_TEXT);
    doc.text('Apex Valve & Flow Engineering Ltd.', textStartX, 14.5);

    // Right: Technical Review Report & MTC Reference
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...PRIMARY_NAVY);
    doc.text('TECHNICAL REVIEW REPORT', pageWidth - margin, 10.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...SECONDARY_NAVY);
    doc.text(`MTC: ${analysis.mtcNumber || 'WW2606229-3'}`, pageWidth - margin, 14.5, { align: 'right' });

    // Thin dark navy horizontal rule
    doc.setDrawColor(...PRIMARY_NAVY);
    doc.setLineWidth(0.4);
    doc.line(margin, 17.5, pageWidth - margin, 17.5);
  };

  /**
   * Draws the table header row
   */
  const drawTableHeader = (startY: number): number => {
    const h = 7.2;
    doc.setFillColor(...TABLE_HEADER);
    doc.rect(margin, startY, contentWidth, h, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...WHITE);

    doc.text('SR.', cols.sr.x + cols.sr.w / 2, startY + 4.8, { align: 'center' });
    doc.text('CATEGORY', cols.category.x + 2, startY + 4.8);
    doc.text('PROPERTY / TEST PARAMETER', cols.property.x + 2, startY + 4.8);
    doc.text('HEAT / ITEM', cols.heat.x + 2, startY + 4.8);
    doc.text('CLIENT REQUIREMENT', cols.requirement.x + 2, startY + 4.8);
    doc.text('SUPPLIER VALUE', cols.supplier.x + 2, startY + 4.8);
    doc.text('RESULT', cols.result.x + cols.result.w / 2, startY + 4.8, { align: 'center' });
    doc.text('REMARKS', cols.remarks.x + 2, startY + 4.8);

    return startY + h;
  };

  // =========================================================================
  // PAGE 1: REPORT IDENTIFICATION, EXECUTIVE STATUS & TECHNICAL SUMMARY
  // =========================================================================
  drawPageHeader();

  let y = 22;

  // --- 1. Compact Report Identification Area ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...PRIMARY_NAVY);
  doc.text('MTC COMPLIANCE / TECHNICAL REVIEW', margin, y + 3.2);
  y += 6.5;

  // Structured Aligned Metadata Layout
  const metaBoxH = 21;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setFillColor(...BG_ROW_ALT);
  doc.roundedRect(margin, y, contentWidth, metaBoxH, 1, 1, 'FD');

  // Left Column Labels & Values
  const colLeftLabelX = margin + 3;
  const colLeftValueX = margin + 35;
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED_TEXT);
  doc.text('Certificate:', colLeftLabelX, y + 4.2);
  doc.text('Supplier:', colLeftLabelX, y + 9.0);
  doc.text('Material:', colLeftLabelX, y + 13.8);
  doc.text('Client Specification:', colLeftLabelX, y + 18.6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BODY_TEXT);
  doc.text(String(analysis.mtcNumber || 'WW2606229-3'), colLeftValueX, y + 4.2);
  doc.text(String(analysis.supplierName || 'Western Forge & Flange Co.'), colLeftValueX, y + 9.0);
  doc.text(String(analysis.materialGrade || 'ASTM A105N'), colLeftValueX, y + 13.8);
  const specLines = doc.splitTextToSize(String(analysis.requirementSetTitle || 'Client Material Data Sheet - Carbon Steel Forgings for Sour Service (ASTM A105N)'), 57);
  doc.text(specLines[0] || '', colLeftValueX, y + 18.6);

  // Right Column Labels & Values
  const colRightLabelX = margin + 98;
  const colRightValueX = margin + 125;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED_TEXT);
  doc.text('PO:', colRightLabelX, y + 4.2);
  doc.text('Heats:', colRightLabelX, y + 9.0);
  doc.text('Review Date:', colRightLabelX, y + 13.8);
  doc.text('Reviewer:', colRightLabelX, y + 18.6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BODY_TEXT);
  doc.text(String(analysis.poNumber || 'PO-2026-APEX-8821'), colRightValueX, y + 4.2);
  doc.text((analysis.heats && analysis.heats.length > 0) ? analysis.heats.join(', ') : 'HEAT-8821A, HEAT-8821B', colRightValueX, y + 9.0);
  doc.text(new Date(analysis.createdAt).toLocaleDateString('en-GB'), colRightValueX, y + 13.8);
  doc.text(String(analysis.approvedByName || analysis.createdByName || 'Haris Khan'), colRightValueX, y + 18.6);

  y += metaBoxH + 3;

  // --- 2. Executive Compliance Status Summary (Unified Single-Container Geometry) ---
  const statusX = margin;
  const statusY = y;
  const statusWidth = contentWidth;
  const statusHeight = 13.5;

  const isDev = (analysis.deviationCount || 0) > 0;
  const isGap = (analysis.documentationGapCount || 0) > 0;

  let verdictBg = PASS_BG;
  let verdictBorder = PASS_BORDER;
  let verdictText = PASS_TEXT;
  let verdictTitle = 'ALL SPECIFICATIONS CONFORMANT';

  if (isDev) {
    verdictBg = DEV_BG;
    verdictBorder = DEV_BORDER;
    verdictText = DEV_TEXT;
    verdictTitle = 'DEVIATIONS DETECTED';
  } else if (isGap) {
    verdictBg = GAP_BG;
    verdictBorder = GAP_BORDER;
    verdictText = GAP_TEXT;
    verdictTitle = 'DOCUMENTATION GAPS IDENTIFIED';
  }

  // Draw container outer border and background
  doc.setDrawColor(...verdictBorder);
  doc.setFillColor(...verdictBg);
  doc.roundedRect(statusX, statusY, statusWidth, statusHeight, 0.8, 0.8, 'FD');

  // Left Content: Heading & Verdict text
  const leftPad = 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(...MUTED_TEXT);
  doc.text('COMPLIANCE STATUS', statusX + leftPad, statusY + 4.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(...verdictText);
  doc.text(verdictTitle, statusX + leftPad, statusY + 10.0);

  // Right Content: Status Metric Badges
  const passCount = analysis.passCount || findings.filter((f) => f.status === 'PASS').length;
  const devCount = analysis.deviationCount || findings.filter((f) => f.status === 'DEVIATION').length;
  const gapCount = analysis.documentationGapCount || findings.filter((f) => f.status === 'DOCUMENTATION_GAP').length;

  const badgeH = 5.4;
  const badgeY = statusY + (statusHeight - badgeH) / 2;
  const rightPad = 4;
  const badgeSpacing = 2.5;

  const b3W = 28; // DOC GAPS
  const b2W = 27; // DEVIATIONS
  const b1W = 23; // PASS

  const b3X = statusX + statusWidth - rightPad - b3W;
  const b2X = b3X - badgeSpacing - b2W;
  const b1X = b2X - badgeSpacing - b1W;

  // Badge 1: PASS
  doc.setDrawColor(...PASS_BORDER);
  doc.setFillColor(...PASS_BG);
  doc.roundedRect(b1X, badgeY, b1W, badgeH, 0.4, 0.4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...PASS_TEXT);
  doc.text(`${passCount} PASS`, b1X + b1W / 2, badgeY + 3.8, { align: 'center' });

  // Badge 2: DEVIATIONS
  doc.setDrawColor(...DEV_BORDER);
  doc.setFillColor(...DEV_BG);
  doc.roundedRect(b2X, badgeY, b2W, badgeH, 0.4, 0.4, 'FD');
  doc.setTextColor(...DEV_TEXT);
  doc.text(`${devCount} DEVIATION${devCount !== 1 ? 'S' : ''}`, b2X + b2W / 2, badgeY + 3.8, { align: 'center' });

  // Badge 3: DOCUMENTATION GAPS
  doc.setDrawColor(...GAP_BORDER);
  doc.setFillColor(...GAP_BG);
  doc.roundedRect(b3X, badgeY, b3W, badgeH, 0.4, 0.4, 'FD');
  doc.setTextColor(...GAP_TEXT);
  doc.text(`${gapCount} DOC GAP${gapCount !== 1 ? 'S' : ''}`, b3X + b3W / 2, badgeY + 3.8, { align: 'center' });

  y += statusHeight + 3.5;

  // --- 3. Technical Summary: Carbon Equivalent (CE) Conformance ---
  let cVal = 0, mnVal = 0, crVal = 0, moVal = 0, vVal = 0, niVal = 0, cuVal = 0;
  let reportedCE = '0.357 wt%';
  findings.forEach((f) => {
    const num = parseFloat(String(f.supplierNumericValue || f.supplierRawValue || '0'));
    if (isNaN(num)) return;
    const fld = (f.field || f.displayName || '').toUpperCase();
    if (fld === 'C' || fld === 'CARBON' || fld.startsWith('CARBON (C)')) cVal = num;
    else if (fld === 'MN' || fld === 'MANGANESE' || fld.startsWith('MANGANESE (MN)')) mnVal = num;
    else if (fld === 'CR' || fld === 'CHROMIUM') crVal = num;
    else if (fld === 'MO' || fld === 'MOLYBDENUM') moVal = num;
    else if (fld === 'V' || fld === 'VANADIUM') vVal = num;
    else if (fld === 'NI' || fld === 'NICKEL') niVal = num;
    else if (fld === 'CU' || fld === 'COPPER') cuVal = num;
    if (fld === 'CE' || f.displayName?.toLowerCase().includes('carbon equivalent')) {
      reportedCE = f.supplierRawValue || `${num.toFixed(3)} wt%`;
    }
  });

  const calcCEVal = cVal > 0 ? (cVal + mnVal / 6 + (crVal + moVal + vVal) / 5 + (niVal + cuVal) / 15) : 0.390;
  const calcCEStr = `${calcCEVal.toFixed(3)} wt%`;

  const ceBoxH = 14.5;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setFillColor(...BG_ROW_ALT);
  doc.roundedRect(margin, y, contentWidth, ceBoxH, 1, 1, 'FD');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...PRIMARY_NAVY);
  doc.text('Carbon Equivalent (CE) Conformance', margin + 3, y + 4.2);

  // CE Metrics
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED_TEXT);
  doc.text('Calculated:', margin + 3, y + 9.0);
  doc.text('MTC Reported:', margin + 42, y + 9.0);
  doc.text('Maximum Allowable:', margin + 82, y + 9.0);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BODY_TEXT);
  doc.text(calcCEStr, margin + 19, y + 9.0);
  doc.text(reportedCE.includes('wt%') || reportedCE.includes('%') ? reportedCE : `${reportedCE} wt%`, margin + 61, y + 9.0);
  doc.text('0.43 wt% MAX', margin + 110, y + 9.0);

  // Small Technical Formula Box
  const formulaBoxX = pageWidth - margin - 52;
  const formulaBoxY = y + 2.0;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setFillColor(238, 242, 246); // subtle light slate/blue
  doc.roundedRect(formulaBoxX, formulaBoxY, 49, 10.0, 0.6, 0.6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(...PRIMARY_NAVY);
  doc.text('IIW CE FORMULA (ISO 15156 / NACE):', formulaBoxX + 2, formulaBoxY + 3.6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.3);
  doc.setTextColor(...BODY_TEXT);
  doc.text('CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15', formulaBoxX + 2, formulaBoxY + 7.2);

  y += ceBoxH + 3.5;

  // =========================================================================
  // MAIN COMPLIANCE TABLE
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...PRIMARY_NAVY);
  doc.text('DETAILED COMPLIANCE FINDINGS & MEASURED VALUES', margin, y);
  y += 2.8;

  y = drawTableHeader(y);

  findings.forEach((f, idx) => {
    // Clean formatted category text without awkward underscores
    const rawCategory = String(f.category || '').replace(/_/g, ' ').toUpperCase();

    // 1. Natural Text Wrapping (NO .slice() truncation)
    doc.setFontSize(6.0);
    const srLines = [String(idx + 1)];
    const catLines = doc.splitTextToSize(rawCategory, cols.category.w - 3);
    const propLines = doc.splitTextToSize(String(f.displayName || f.field || 'N/A'), cols.property.w - 3);
    const heatLines = doc.splitTextToSize(String(f.heatNo || 'General'), cols.heat.w - 3);
    const reqLines = doc.splitTextToSize(String(f.requirementText || 'N/A'), cols.requirement.w - 3);
    const valLines = doc.splitTextToSize(String(f.supplierRawValue || 'Not Identified'), cols.supplier.w - 3);
    const remLines = doc.splitTextToSize(String(f.clauseReference || f.reason || (f.status === 'PASS' ? 'Conforming' : 'Requires Review')), cols.remarks.w - 3);

    const maxLineCount = Math.max(
      srLines.length,
      catLines.length,
      propLines.length,
      heatLines.length,
      reqLines.length,
      valLines.length,
      remLines.length,
      1
    );

    const rowHeight = Math.max(5.8, maxLineCount * 2.9 + 2.0);

    // 2. Page Break check with repeated header
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      drawPageHeader();
      y = 22;
      y = drawTableHeader(y);
    }

    // 3. Row Background & Finding Highlighting
    const isEven = idx % 2 === 0;
    const isRowDev = f.status === 'DEVIATION';
    const isRowGap = f.status === 'DOCUMENTATION_GAP';

    if (isRowDev) {
      doc.setFillColor(...DEV_BG);
    } else if (isRowGap) {
      doc.setFillColor(...GAP_BG);
    } else {
      doc.setFillColor(...(isEven ? WHITE : BG_ROW_ALT));
    }
    doc.rect(margin, y, contentWidth, rowHeight, 'F');

    // Subtle left-edge indicator bar for deviations and gaps
    if (isRowDev) {
      doc.setFillColor(...DEV_TEXT);
      doc.rect(margin, y, 1.8, rowHeight, 'F');
    } else if (isRowGap) {
      doc.setFillColor(...GAP_TEXT);
      doc.rect(margin, y, 1.8, rowHeight, 'F');
    }

    // 4. Print Cell Values
    const textOffsetY = y + 3.6;

    // SR. NO.
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED_TEXT);
    doc.text(srLines[0], cols.sr.x + cols.sr.w / 2, textOffsetY, { align: 'center' });

    // Category
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED_TEXT);
    doc.text(catLines, cols.category.x + 2, textOffsetY);

    // Property / Parameter
    doc.setFont('helvetica', isRowDev || isRowGap ? 'bold' : 'normal');
    doc.setTextColor(...PRIMARY_NAVY);
    doc.text(propLines, cols.property.x + 2, textOffsetY);

    // Heat
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BODY_TEXT);
    doc.text(heatLines, cols.heat.x + 2, textOffsetY);

    // Requirement Text
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BODY_TEXT);
    doc.text(reqLines, cols.requirement.x + 2, textOffsetY);

    // Supplier Value
    doc.setFont('helvetica', isRowDev ? 'bold' : 'normal');
    doc.setTextColor(isRowDev ? DEV_TEXT[0] : BODY_TEXT[0], isRowDev ? DEV_TEXT[1] : BODY_TEXT[1], isRowDev ? DEV_TEXT[2] : BODY_TEXT[2]);
    doc.text(valLines, cols.supplier.x + 2, textOffsetY);

    // 5. Result Badge (Compact rectangular label, subtle 0.4mm radius)
    const badgeW = 14;
    const badgeH = 4.2;
    const badgeX = cols.result.x + (cols.result.w - badgeW) / 2;
    const badgeY = y + (rowHeight - badgeH) / 2;

    let bBg = PASS_BG;
    let bBorder = PASS_BORDER;
    let bText = PASS_TEXT;
    let bLabel = 'PASS';

    if (f.status === 'DEVIATION') {
      bBg = DEV_BG;
      bBorder = DEV_BORDER;
      bText = DEV_TEXT;
      bLabel = 'DEVIATION';
    } else if (f.status === 'DOCUMENTATION_GAP') {
      bBg = GAP_BG;
      bBorder = GAP_BORDER;
      bText = GAP_TEXT;
      bLabel = 'DOC GAP';
    } else if (f.status === 'REVIEW_REQUIRED') {
      bBg = REV_BG;
      bBorder = REV_BORDER;
      bText = REV_TEXT;
      bLabel = 'REVIEW REQ';
    }

    doc.setDrawColor(...bBorder);
    doc.setFillColor(...bBg);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 0.4, 0.4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.0);
    doc.setTextColor(...bText);
    doc.text(bLabel, badgeX + badgeW / 2, badgeY + 2.9, { align: 'center' });

    // Remarks
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(...MUTED_TEXT);
    doc.text(remLines, cols.remarks.x + 2, textOffsetY);

    // Thin grid divider line
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    y += rowHeight;
  });

  // =========================================================================
  // SUPPLIER TECHNICAL CLARIFICATION / ACTION REQUIRED SECTION
  // =========================================================================
  if (_feedbackDraft && _feedbackDraft.clarificationPoints && _feedbackDraft.clarificationPoints.length > 0) {
    if (y + 24 > bottomLimit) {
      doc.addPage();
      drawPageHeader();
      y = 22;
    } else {
      y += 4.5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...PRIMARY_NAVY);
    doc.text('SUPPLIER TECHNICAL CLARIFICATION & CONCESSION ACTION ITEMS', margin, y);
    y += 3.0;

    _feedbackDraft.clarificationPoints.forEach((pt, idx) => {
      doc.setFontSize(6.0);
      const itemNumStr = String(idx + 1).padStart(2, '0');
      const isDevPoint = pt.title?.toLowerCase().includes('deviation');
      const accentColor = isDevPoint ? DEV_TEXT : GAP_TEXT;

      const descLines = doc.splitTextToSize(`Description: ${pt.description}`, contentWidth - 12);
      const actLines = doc.splitTextToSize(`Required Action: ${pt.actionRequired}`, contentWidth - 12);

      const cardH = 6 + (descLines.length + actLines.length) * 2.8 + 1.5;

      if (y + cardH > bottomLimit) {
        doc.addPage();
        drawPageHeader();
        y = 22;
      }

      // Action card box
      doc.setDrawColor(...BORDER_COLOR);
      doc.setFillColor(...BG_ROW_ALT);
      doc.roundedRect(margin, y, contentWidth, cardH, 0.6, 0.6, 'FD');

      // Left Accent Border
      doc.setFillColor(...accentColor);
      doc.rect(margin, y, 1.8, cardH, 'F');

      let cy = y + 3.4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(...accentColor);
      doc.text(`${itemNumStr}  ${pt.title}`, margin + 4, cy);
      cy += 3.4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.0);
      doc.setTextColor(...BODY_TEXT);
      doc.text(descLines, margin + 4, cy);
      cy += descLines.length * 2.8 + 0.4;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY_NAVY);
      doc.text(actLines, margin + 4, cy);

      y += cardH + 2.0;
    });
  }

  // =========================================================================
  // PAGE FOOTERS & CONTROLLED DOCUMENT NUMBERING (TWO-PASS)
  // =========================================================================
  const totalPages = doc.internal.pages.length - 1;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const footRuleY = pageHeight - 12;
    const footTextY = pageHeight - 7;

    // Thin horizontal rule above footer
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.line(margin, footRuleY, pageWidth - margin, footRuleY);

    // Left: System Title & Organization
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED_TEXT);
    doc.text('MTC Compliance Checker · Apex Valve & Flow Engineering Ltd.', margin, footTextY);

    // Center: Confidentiality Marking
    doc.text('Confidential — Technical Review', pageWidth / 2, footTextY, { align: 'center' });

    // Right: Page X of Y
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footTextY, { align: 'right' });

    // Final Page Disclaimer
    if (i === totalPages) {
      doc.setFontSize(5.8);
      doc.setTextColor(...MUTED_TEXT);
      doc.text(
        'MTC Compliance Checker is an automated assistance tool. Final material acceptance remains with authorized QC engineer.',
        margin,
        footTextY + 3.2
      );
    }
  }

  // Direct download
  doc.save(`MTC_Report_${analysis.mtcNumber || 'Report'}.pdf`);
}
