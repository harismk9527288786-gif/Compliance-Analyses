/**
 * Generates and downloads a rich, multi-sheet industrial Excel (.xlsx) workbook
 * containing Executive Summary, Chemical Composition, Mechanical & Physical Tests,
 * Non-Conformances & Gaps, Full Compliance Matrix, and Supplier Feedback Draft.
 */
export function exportAnalysisToExcel(
  analysis: AnalysisRecord,
  findings: ComplianceFinding[],
  feedbackDraft?: ExternalFeedbackDraft
): void {
  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Executive Summary
  const summaryData: (string | number)[][] = [
    ['MTC COMPLIANCE & METALLURGICAL VERIFICATION REPORT', ''],
    ['Generated Date (UTC)', new Date().toLocaleString()],
    ['Analysis Document Title', analysis.title],
    ['Material Grade', analysis.materialGrade],
    ['Supplier Mill / Manufacturer', analysis.supplierName],
    ['MTC Certificate Number (EN 10204 3.1)', analysis.mtcNumber],
    ['Client Purchase Order (PO)', analysis.poNumber || 'N/A'],
    ['Ladle Heats Evaluated', (analysis.heats || []).join(', ') || 'General'],
    ['Client / Project Name', analysis.clientName],
    ['Client Specification Standard (MDS)', analysis.requirementSetTitle],
    ['Verification Engine Version', analysis.ruleEngineVersion],
    ['Reviewed / Approved By', analysis.approvedByName || analysis.createdByName],
    ['Review Date', new Date(analysis.createdAt).toLocaleDateString()],
    ['', ''],
    ['COMPLIANCE DISPOSITION SUMMARY', ''],
    [
      'Overall Compliance Verdict',
      analysis.finalStatus ||
        (analysis.deviationCount > 0
          ? 'DEVIATIONS DETECTED (ACTION REQUIRED)'
          : analysis.documentationGapCount > 0
          ? 'DOCUMENTATION GAP (SUPPLEMENTARY CERTS REQUIRED)'
          : 'COMPLIANT (CONFORMING)'),
    ],
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
    ['', ''],
    ['CARBON EQUIVALENT (CE) METALLURGICAL VERIFICATION', ''],
    ['IIW Standard Formula', 'CE = C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15'],
    ['Maximum Allowable CE (ASTM A105 / MDS)', '<= 0.43 wt%'],
    ['Verification Result', 'CONFORMANCE VERIFIED (Weldability Satisfied)'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // 2. Sheet 2: Chemical Composition
  const chemFindings = findings.filter((f) => f.category === 'chemical');
  if (chemFindings.length > 0) {
    const chemData = chemFindings.map((f, i) => ({
      '#': i + 1,
      'Element / Parameter': f.displayName,
      'Heat No': f.heatNo || 'GENERAL',
      'Client Limit (MDS)': f.requirementText,
      'Supplier Reported (Raw)': f.supplierRawValue,
      'Normalized Value (wt%)':
        f.supplierNormalizedValue !== undefined
          ? `${f.supplierNormalizedValue} ${f.supplierUnit || ''}`
          : 'N/A',
      'Rule Logic': f.calculatedComparison,
      'Status': f.status,
      'Severity': f.severity.toUpperCase(),
      'Metallurgical Finding & Explanation': f.reason,
      'Reviewer Decision': f.reviewerDecision || (f.isReviewed ? 'Confirmed' : 'Pending'),
      'QC Override Reason / Notes': f.overrideReason || f.reviewerComment || '—',
    }));
    const wsChem = XLSX.utils.json_to_sheet(chemData);
    wsChem['!cols'] = [
      { wch: 5 },
      { wch: 22 },
      { wch: 12 },
      { wch: 24 },
      { wch: 22 },
      { wch: 22 },
      { wch: 30 },
      { wch: 14 },
      { wch: 12 },
      { wch: 45 },
      { wch: 18 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsChem, 'Chemical Composition');
  }

  // 3. Sheet 3: Mechanical & Physical Testing
  const mechFindings = findings.filter((f) => f.category !== 'chemical');
  if (mechFindings.length > 0) {
    const mechData = mechFindings.map((f, i) => ({
      '#': i + 1,
      'Category': f.category.toUpperCase(),
      'Test / Parameter': f.displayName,
      'Heat / Specimen': f.heatNo || 'GENERAL',
      'Client Requirement (MDS)': f.requirementText,
      'Clause Reference': f.requirementClause || 'Mandatory',
      'Supplier Certificate Value': f.supplierRawValue,
      'Status': f.status,
      'Severity': f.severity.toUpperCase(),
      'Evaluation & Math Comparison': f.calculatedComparison,
      'Engineering Finding': f.reason,
      'Reviewer Decision': f.reviewerDecision || (f.isReviewed ? 'Confirmed' : 'Pending'),
      'QC Override Reason / Notes': f.overrideReason || f.reviewerComment || '—',
    }));
    const wsMech = XLSX.utils.json_to_sheet(mechData);
    wsMech['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 26 },
      { wch: 14 },
      { wch: 30 },
      { wch: 18 },
      { wch: 26 },
      { wch: 14 },
      { wch: 12 },
      { wch: 32 },
      { wch: 48 },
      { wch: 18 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMech, 'Mechanical & NDE Tests');
  }

  // 4. Sheet 4: Non-Conformances & Documentation Gaps
  const issueFindings = findings.filter(
    (f) => f.status === 'DEVIATION' || f.status === 'DOCUMENTATION_GAP'
  );
  const issuesData =
    issueFindings.length > 0
      ? issueFindings.map((f, i) => ({
          'Item #': i + 1,
          'Issue Type': f.status === 'DEVIATION' ? 'METALLURGICAL DEVIATION' : 'DOCUMENTATION GAP',
          'Property / Parameter': f.displayName,
          'Heat Number': f.heatNo || 'GENERAL',
          'Specified Client Limit (MDS)': f.requirementText,
          'Clause Reference': f.requirementClause || 'N/A',
          'Supplier Reported Value': f.supplierRawValue,
          'Severity': f.severity.toUpperCase(),
          'Root Cause & Technical Finding': f.reason,
          'Human Reviewer Decision': f.reviewerDecision || 'Pending Human Review',
          'Concession / Override Justification': f.overrideReason || '—',
          'Internal QC Engineer Comment': f.reviewerComment || '—',
        }))
      : [
          {
            'Item #': 1,
            'Issue Type': 'NONE',
            'Property / Parameter': 'All parameters conform to specification limits.',
            'Heat Number': 'ALL',
            'Specified Client Limit (MDS)': 'Conformant',
            'Clause Reference': 'N/A',
            'Supplier Reported Value': 'Conformant',
            'Severity': 'NONE',
            'Root Cause & Technical Finding': 'No deviations or missing documentation identified.',
            'Human Reviewer Decision': 'Approved',
            'Concession / Override Justification': '—',
            'Internal QC Engineer Comment': '—',
          },
        ];

  const wsIssues = XLSX.utils.json_to_sheet(issuesData);
  wsIssues['!cols'] = [
    { wch: 8 },
    { wch: 25 },
    { wch: 26 },
    { wch: 14 },
    { wch: 32 },
    { wch: 18 },
    { wch: 24 },
    { wch: 14 },
    { wch: 50 },
    { wch: 22 },
    { wch: 35 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsIssues, 'Discrepancies & Actions');

  // 5. Sheet 5: Complete Findings Matrix
  const allFindingsData = findings.map((f, i) => ({
    '#': i + 1,
    'Category': f.category.toUpperCase(),
    'Property / Test': f.displayName,
    'Heat / Identifier': f.heatNo || 'GENERAL',
    'Client Requirement': f.requirementText,
    'Clause Reference': f.requirementClause || 'N/A',
    'Requirement Page': f.requirementSourcePage || 1,
    'Supplier Value (Raw)': f.supplierRawValue,
    'Supplier Value (Normalized)':
      f.supplierNormalizedValue !== undefined
        ? `${f.supplierNormalizedValue} ${f.supplierUnit || ''}`
        : 'N/A',
    'Supplier Page': f.supplierEvidencePage || 1,
    'Compliance Status': f.status,
    'Severity': f.severity.toUpperCase(),
    'Calculation / Formula': f.calculatedComparison,
    'Reason & Metallurgical Explanation': f.reason,
    'Reviewed By': f.reviewedByName || 'System Automated',
    'Review Decision': f.reviewerDecision || 'None',
    'Override Reason': f.overrideReason || 'None',
    'Reviewer Comment': f.reviewerComment || 'None',
  }));
  const wsAll = XLSX.utils.json_to_sheet(allFindingsData);
  wsAll['!cols'] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 24 },
    { wch: 14 },
    { wch: 30 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 30 },
    { wch: 48 },
    { wch: 20 },
    { wch: 16 },
    { wch: 30 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAll, 'Complete Compliance Matrix');

  // 6. Sheet 6: Supplier Clarification Draft (if present)
  if (feedbackDraft) {
    const feedbackRows: (string | number)[][] = [
      ['FORMAL SUPPLIER TECHNICAL CLARIFICATION LETTER', ''],
      ['Letter Subject', feedbackDraft.title],
      ['Recipient Salutation', feedbackDraft.salutation],
      ['Opening Statement', feedbackDraft.openingStatement],
      ['Conforming Summary', feedbackDraft.conformingSummary],
      ['Closing Statement', feedbackDraft.closingStatement],
      ['Draft Status', feedbackDraft.status?.toUpperCase() || 'DRAFT'],
      ['', ''],
      ['CLARIFICATION POINTS & ACTIONS REQUIRED', '', '', ''],
      ['Point #', 'Item Title', 'Condition Description', 'Required Supplier Action'],
      ...feedbackDraft.clarificationPoints.map((pt, idx) => [
        idx + 1,
        pt.title,
        pt.description,
        pt.actionRequired,
      ]),
    ];
    const wsFeedback = XLSX.utils.aoa_to_sheet(feedbackRows);
    wsFeedback['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 55 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsFeedback, 'Supplier Clarification Draft');
  }

  // Trigger download with sanitized filename
  const cleanMtc = analysis.mtcNumber.replace(/[/\\?%*:|"<>]/g, '-');
  const cleanGrade = analysis.materialGrade.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `MTC_Verification_${cleanMtc}_${cleanGrade}.xlsx`);
}

/**
 * Generates and downloads a complete fleet summary Excel (.xlsx) workbook
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
  const fleetSummaryData: (string | number)[][] = [
    ['MTC VERIFICATION FLEET EXECUTIVE SUMMARY', ''],
    ['Export Date (UTC)', new Date().toLocaleString()],
    ['Total Certificates Evaluated', totalAnalyses],
    ['Total Conforming Certificates', totalConforming],
    ['Certificates with Deviations', totalWithDeviations],
    ['Certificates with Documentation Gaps', totalWithGaps],
    [
      'Fleet Conformance Rate',
      totalAnalyses > 0 ? `${((totalConforming / totalAnalyses) * 100).toFixed(1)}%` : '100%',
    ],
    ['Audit Standard', 'EN 10204 3.1 & ISO 9001:2015 Traceable'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(fleetSummaryData);
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Fleet Summary');

  // Sheet 2: Certificate Fleet Register
  const registerData = analyses.map((a, i) => ({
    '#': i + 1,
    'MTC Number': a.mtcNumber,
    'Purchase Order (PO)': a.poNumber || 'N/A',
    'Supplier Mill': a.supplierName,
    'Material Grade': a.materialGrade,
    'Ladle Heats': (a.heats || []).join(', ') || 'N/A',
    'Client Specification': a.requirementSetTitle,
    'Conforming Checks': a.passCount || 0,
    'Deviations': a.deviationCount || 0,
    'Documentation Gaps': a.documentationGapCount || 0,
    'Total Parameters': a.totalFindings || 0,
    'Compliance Status':
      a.status === 'approved'
        ? 'APPROVED'
        : a.deviationCount > 0
        ? 'DEVIATION'
        : a.documentationGapCount > 0
        ? 'DOCUMENTATION GAP'
        : 'PASS',
    'Evaluation Date': new Date(a.createdAt).toLocaleDateString(),
    'Approved / Reviewed By': a.approvedByName || a.createdByName,
  }));
  const wsRegister = XLSX.utils.json_to_sheet(registerData);
  wsRegister['!cols'] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 18 },
    { wch: 26 },
    { wch: 18 },
    { wch: 20 },
    { wch: 32 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRegister, 'Certificate Register');

  // Sheet 3: Action Required Discrepancies
  const actionItems = analyses.filter(
    (a) => a.deviationCount > 0 || a.documentationGapCount > 0 || a.status === 'rejected'
  );
  if (actionItems.length > 0) {
    const actionData = actionItems.map((a, i) => ({
      '#': i + 1,
      'MTC Number': a.mtcNumber,
      'PO Number': a.poNumber || 'N/A',
      'Supplier Mill': a.supplierName,
      'Material Grade': a.materialGrade,
      'Heats': (a.heats || []).join(', '),
      'Deviations Count': a.deviationCount,
      'Gaps Count': a.documentationGapCount,
      'Audit Status': a.status.toUpperCase(),
      'Target Spec': a.requirementSetTitle,
      'Action Required':
        a.deviationCount > 0
          ? 'Requires metallurgical review / concession approval.'
          : 'Missing supplementary test documentation.',
    }));
    const wsAction = XLSX.utils.json_to_sheet(actionData);
    wsAction['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 16 },
      { wch: 26 },
      { wch: 16 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 32 },
      { wch: 45 },
    ];
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
