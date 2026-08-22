import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { AnalysisRecord, ComplianceFinding, ExternalFeedbackDraft } from '../types';

/**
 * Generates and downloads an Excel workbook containing compliance review findings
 */
export function exportAnalysisToExcel(
  analysis: AnalysisRecord,
  findings: ComplianceFinding[]
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ['MTC COMPLIANCE REVIEW REPORT', ''],
    ['Generated Date', new Date().toLocaleString()],
    ['Analysis Title', analysis.title],
    ['Material Grade', analysis.materialGrade],
    ['Supplier Name', analysis.supplierName],
    ['MTC Number', analysis.mtcNumber],
    ['PO Number', analysis.poNumber || 'N/A'],
    ['Heats Checked', (analysis.heats || []).join(', ')],
    ['Client Name', analysis.clientName],
    ['Requirement Document', analysis.requirementSetTitle],
    [
      'Overall Status',
      analysis.finalStatus ||
        (analysis.deviationCount > 0
          ? 'DEVIATIONS DETECTED'
          : analysis.documentationGapCount > 0
          ? 'DOCUMENTATION GAP'
          : 'COMPLIANT'),
    ],
    ['Reviewed By', analysis.approvedByName || analysis.createdByName],
    ['Rule Engine Version', analysis.ruleEngineVersion],
    ['', ''],
    ['METRIC COUNTS', ''],
    ['PASS Count', analysis.passCount],
    ['DEVIATION Count', analysis.deviationCount],
    ['DOCUMENTATION GAP Count', analysis.documentationGapCount],
    ['Total Checks', analysis.totalFindings],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 2: Detailed Findings
  const findingsData = findings.map((f, i) => ({
    '#': i + 1,
    'Category': f.category.toUpperCase(),
    'Item / Property': f.displayName,
    'Heat / Identifier': f.heatNo || 'GENERAL',
    'Client Requirement': f.requirementText,
    'Clause Reference': f.requirementClause || 'N/A',
    'Requirement Page': f.requirementSourcePage,
    'Supplier Value (Raw)': f.supplierRawValue,
    'Supplier Value (Normalized)': f.supplierNormalizedValue !== undefined ? `${f.supplierNormalizedValue} ${f.supplierUnit || ''}` : 'N/A',
    'Supplier Page': f.supplierEvidencePage || 'N/A',
    'Compliance Status': f.status,
    'Severity': f.severity.toUpperCase(),
    'Calculation / Formula': f.calculatedComparison,
    'Reason & Metallurgical Explanation': f.reason,
    'Reviewed By': f.reviewedByName || 'System Automated',
    'Reviewer Comment': f.reviewerComment || 'None',
  }));

  const wsFindings = XLSX.utils.json_to_sheet(findingsData);
  XLSX.utils.book_append_sheet(wb, wsFindings, 'Detailed Compliance');

  // Trigger download
  XLSX.writeFile(wb, `MTC_Review_${analysis.mtcNumber}_${analysis.materialGrade.replace(/\s+/g, '_')}.xlsx`);
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
  doc.text(`Date: ${new Date(analysis.createdAt).toLocaleDateString()} | Reviewer: ${analysis.approvedByName || analysis.createdByName}`, 14, 54);

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
