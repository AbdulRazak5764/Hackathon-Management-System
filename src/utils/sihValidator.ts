import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface SIHValidationReport {
  fileName: string;
  fileSize: number;
  fileType: 'pdf' | 'pptx' | 'unknown';
  slideCount: number;
  maxAllowedSlides: number;
  status: 'VALID' | 'NEEDS_CORRECTION' | 'INVALID';
  issues: string[];
  detectedHeaders: string[];
  missingHeaders: string[];
  summary: string;
}

export const MANDATORY_SIH_SLIDES = [
  { slideNum: 1, name: 'TITLE PAGE', keywords: ['title page', 'problem statement id', 'team name', 'sih 2026', 'smart india hackathon'] },
  { slideNum: 2, name: 'IDEA TITLE', keywords: ['idea title', 'proposed solution', 'idea', 'solution', 'prototype'] },
  { slideNum: 3, name: 'TECHNICAL APPROACH', keywords: ['technical approach', 'technologies', 'methodology', 'architecture', 'process'] },
  { slideNum: 4, name: 'FEASIBILITY AND VIABILITY', keywords: ['feasibility', 'viability', 'challenges', 'risks', 'strategies'] },
  { slideNum: 5, name: 'IMPACT AND BENEFITS', keywords: ['impact', 'benefits', 'target audience', 'social', 'economic'] },
  { slideNum: 6, name: 'RESEARCH AND REFERENCES', keywords: ['research', 'references', 'links', 'details'] },
];

export async function validateSIHSubmission(file: File): Promise<SIHValidationReport> {
  const fileName = file.name;
  const fileSize = file.size;
  const ext = fileName.split('.').pop()?.toLowerCase();

  const report: SIHValidationReport = {
    fileName,
    fileSize,
    fileType: ext === 'pdf' ? 'pdf' : ext === 'pptx' || ext === 'ppt' ? 'pptx' : 'unknown',
    slideCount: 0,
    maxAllowedSlides: 6,
    status: 'VALID',
    issues: [],
    detectedHeaders: [],
    missingHeaders: [],
    summary: '',
  };

  if (ext !== 'pdf' && ext !== 'pptx' && ext !== 'ppt') {
    report.status = 'INVALID';
    report.issues.push('Invalid file format. SIH official guidelines require submission in PDF or PPTX format.');
    report.summary = 'File format not supported.';
    return report;
  }

  try {
    let slideTexts: string[] = [];

    if (ext === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      report.slideCount = pdf.numPages;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ').toLowerCase();
        slideTexts.push(pageText);
      }
    } else if (ext === 'pptx') {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      const slideFiles = Object.keys(content.files).filter(path => path.startsWith('ppt/slides/slide') && path.endsWith('.xml'));
      report.slideCount = slideFiles.length;

      for (let i = 1; i <= slideFiles.length; i++) {
        const slideFile = content.files[`ppt/slides/slide${i}.xml`];
        if (slideFile) {
          const xmlText = await slideFile.async('text');
          const cleanText = xmlText.replace(/<[^>]+>/g, ' ').toLowerCase();
          slideTexts.push(cleanText);
        }
      }
    } else {
      // Legacy .ppt basic fallback
      report.slideCount = 6; // default approximation
    }

    // 1. SLIDE COUNT VALIDATION (MAXIMUM 6 SLIDES STRICTLY ENFORCED)
    if (report.slideCount > 6) {
      report.status = 'NEEDS_CORRECTION';
      report.issues.push(`Exceeds maximum allowed slides! SIH template permits exactly max 6 slides. Uploaded document has ${report.slideCount} slides.`);
    } else if (report.slideCount < 5) {
      report.status = 'NEEDS_CORRECTION';
      report.issues.push(`Incomplete presentation. Uploaded document has only ${report.slideCount} slides (Expected 6 slides).`);
    }

    // 2. HEADER & SECTION STRUCTURAL INSPECTION
    MANDATORY_SIH_SLIDES.forEach(req => {
      const foundInAnySlide = slideTexts.some(text => 
        req.keywords.some(kw => text.includes(kw))
      );

      if (foundInAnySlide) {
        report.detectedHeaders.push(req.name);
      } else {
        report.missingHeaders.push(req.name);
        report.issues.push(`Required section "${req.name}" was not detected in slide content.`);
      }
    });

    // 3. FINAL STATUS ASSIGNMENT
    if (report.issues.length > 0) {
      report.status = report.slideCount > 6 ? 'INVALID' : 'NEEDS_CORRECTION';
      report.summary = `Format Issues Detected (${report.issues.length} warning${report.issues.length > 1 ? 's' : ''}). Please adjust slides.`;
    } else {
      report.status = 'VALID';
      report.summary = 'Complies with official SIH 2026 6-Slide Template specifications!';
    }

  } catch (err: any) {
    console.error('SIH Validation Error:', err);
    report.status = 'NEEDS_CORRECTION';
    report.issues.push('Could not parse document structure completely. Please verify file integrity.');
    report.summary = 'Inspection warning.';
  }

  return report;
}
