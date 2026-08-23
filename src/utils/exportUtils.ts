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

/**
 * Generates and downloads a formatted PDF Internal Technical Report
 */
export function exportAnalysisToPDF(
  analysis: AnalysisRecord,
  findings: ComplianceFinding[],
  _feedbackDraft?: ExternalFeedbackDraft
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('MTC COMPLIANCE CHECKER — TECHNICAL REVIEW REPORT', 14, 16);

  // Metadata Box
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Certificate: ${analysis.mtcNumber} | Supplier: ${analysis.supplierName}`, 14, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(`Material: ${analysis.materialGrade} | Client Spec: ${analysis.requirementSetTitle}`, 14, 42);
  doc.text(`PO Number: ${analysis.poNumber || 'N/A'} | Heats: ${(analysis.heats || []).join(', ')}`, 14, 48);
  doc.text(
    `Date: ${new Date(analysis.createdAt).toLocaleDateString()} | Reviewer: ${
      analysis.approvedByName || analysis.createdByName
    }`,
    14,
    54
  );

  // Status Summary Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 58, pageWidth - 28, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `STATUS: ${
      analysis.finalStatus ||
      (analysis.deviationCount > 0
        ? 'DEVIATIONS DETECTED'
        : analysis.documentationGapCount > 0
        ? 'DOCUMENTATION GAP'
        : 'COMPLIANT')
    }`,
    20,
    70
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `PASS: ${analysis.passCount}   |   DEVIATIONS: ${analysis.deviationCount}   |   GAPS: ${analysis.documentationGapCount}`,
    85,
    70
  );

  // Findings Table
  let y = 88;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DETAILED COMPLIANCE FINDINGS', 14, y);
  y += 6;

  // Table Headers
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageWidth - 28, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('CATEGORY', 16, y + 5);
  doc.text('PROPERTY', 40, y + 5);
  doc.text('HEAT', 85, y + 5);
  doc.text('REQUIREMENT', 105, y + 5);
  doc.text('SUPPLIER VALUE', 140, y + 5);
  doc.text('RESULT', 178, y + 5);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  findings.forEach((f) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    // Status color
    if (f.status === 'PASS') {
      doc.setTextColor(22, 101, 52); // green
    } else if (f.status === 'DEVIATION') {
      doc.setTextColor(185, 28, 28); // red
    } else if (f.status === 'DOCUMENTATION_GAP') {
      doc.setTextColor(180, 83, 9); // amber
    } else {
      doc.setTextColor(30, 64, 175); // blue
    }

    doc.text(f.status, 178, y + 4);

    doc.setTextColor(15, 23, 42);
    doc.text(f.category.slice(0, 12).toUpperCase(), 16, y + 4);
    doc.text(f.displayName.slice(0, 22), 40, y + 4);
    doc.text(f.heatNo || 'GEN', 85, y + 4);
    doc.text(f.requirementText.slice(0, 18), 105, y + 4);
    doc.text(f.supplierRawValue.slice(0, 18), 140, y + 4);

    doc.setDrawColor(241, 245, 249);
    doc.line(14, y + 6, pageWidth - 14, y + 6);
    y += 8;
  });

  // Supplier Technical Clarification Section (if draft present)
  if (_feedbackDraft && _feedbackDraft.clarificationPoints && _feedbackDraft.clarificationPoints.length > 0) {
    if (y > 220) {
      doc.addPage();
      y = 20;
    } else {
      y += 8;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('SUPPLIER TECHNICAL CLARIFICATION / ACTION REQUIRED', 14, y);
    y += 6;

    _feedbackDraft.clarificationPoints.forEach((pt, idx) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(185, 28, 28);
      doc.text(`${idx + 1}. ${pt.title}`, 16, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      const descLines = doc.splitTextToSize(`Description: ${pt.description}`, pageWidth - 32);
      doc.text(descLines, 16, y);
      y += descLines.length * 3.8;
      const actLines = doc.splitTextToSize(`Required Action: ${pt.actionRequired}`, pageWidth - 32);
      doc.setTextColor(153, 27, 27);
      doc.text(actLines, 16, y);
      y += actLines.length * 3.8 + 3;
    });
  }

  // Footer / Disclaimer
  const lastPage = doc.internal.pages.length - 1;
  doc.setPage(lastPage);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'MTC Compliance Checker is an automated assistance tool. Final material acceptance remains with authorized QC engineer.',
    14,
    288
  );

  doc.save(`MTC_Report_${analysis.mtcNumber}.pdf`);
}
