# MTC Compliance Checker

> **Deterministic Metallurgical Verification & Quality Assurance Suite**  
> Automated cross-examination of EN 10204 3.1 Mill Test Certificates against client Material Data Sheets (MDS), ASTM/ASME standards, and ISO 15156 / NACE MR0175 sour service specifications.

---

## 📌 Overview

**MTC Compliance Checker** is an industrial-grade quality engineering web application built for QA/QC departments, metallurgical engineers, and procurement inspectors. It eliminates manual spreadsheet checking and human verification errors by performing automated, deterministic clause-by-clause compliance analysis on metallic product inspection documents.

### Key Capabilities
- **Deterministic Multi-Heat Verification**: Automatically parses chemical composition, ladle heats, tensile/yield strengths, elongation, reduction of area, Charpy impact energy, and heat treatment cycles.
- **Carbon Equivalent (CE) Calculation**: Computes international IIW Carbon Equivalent formulas ($CE = C + \frac{Mn}{6} + \frac{Cr+Mo+V}{5} + \frac{Ni+Cu}{15}$) and validates against client maximum allowable thresholds.
- **Traceable Compliance Rails**: Every finding provides the exact source clause reference (e.g. `MDS Clause 4.2`), heat identifier (`Heat #YBA`), measured supplier value, and tolerance deviation delta.
- **Human-in-the-Loop Review**: Allows certified QC reviewers to inspect clauses, log mandatory engineering concession notes, and formally sign off or reject material lots.
- **Direct Deliverables Generation**: Generates downloadable PDF Inspection Reports, formatted Excel workbooks, and structured technical supplier clarification letters.
- **PWA Desktop Installation**: Installable directly as a native standalone desktop app on Windows, macOS, and Linux.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm` (bundled with Node.js)

### Installation & Local Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/harismk9527288786-gif/Compliance-Analyses.git
   cd Compliance-Analyses
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Add your optional configuration in `.env`:
   ```env
   PORT=3000
   GEMINI_API_KEY="your_optional_api_key"
   SEED_DEMO_DATA="true"
   ```

4. **Start the application:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Technical Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, jsPDF, XLSX.
- **Backend Server**: Node.js, Express, Multer, REST API.
- **Verification Engine**: Deterministic rules engine (`src/engine/rules.ts`), metallurgical unit conversion, IIW math validators.
- **Security & Standards**: ISO 9001 / EN 10204 compliance ledger, zero third-party telemetry, client-side report export.

---

## 📄 License & Compliance

Built for enterprise quality assurance & materials engineering verification.
