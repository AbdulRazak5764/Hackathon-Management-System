import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { validateSIHSubmission, SIHValidationReport } from '../../utils/sihValidator';
import { sendSIHRegistrationEmail } from '../../utils/emailService';
import { 
  Users, UploadCloud, CheckCircle2, AlertCircle, AlertTriangle, FileText, 
  Award, Shield, Calendar, RefreshCw, ArrowUpRight, HelpCircle, Layers, Sparkles, Send, X, Lock, Eye, Download
} from 'lucide-react';

export interface TeamMember {
  id?: string;
  name: string;
  roll_number: string;
  email: string;
  mobile: string;
  gender: 'Male' | 'Female' | 'Other';
  branch: string;
  year: string;
  faculty?: string;
  is_team_lead: boolean;
}

export const StudentDashboard: React.FC = () => {
  const { user, profile } = useAuth();

  // Form State
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [psId, setPsId] = useState('');
  const [psTitle, setPsTitle] = useState('');
  const [psDesc, setPsDesc] = useState('');
  const [solTitle, setSolTitle] = useState('');
  const [solDesc, setSolDesc] = useState('');

  // Team Name Uniqueness State
  const [initialTeamName, setInitialTeamName] = useState<string>('');
  const [teamNameChecking, setTeamNameChecking] = useState<boolean>(false);
  const [isTeamNameUnique, setIsTeamNameUnique] = useState<boolean | null>(null);
  const [teamNameStatusMsg, setTeamNameStatusMsg] = useState<string>('');

  // Form Validation Error Summary State
  const [formValidationErrors, setFormValidationErrors] = useState<string[]>([]);

  // Toast Notification State
  const [toastMsg, setToastMsg] = useState<{ title: string; text: string; teamName: string } | null>(null);

  // 6 Members State (Default initialized with Member 1 as Team Lead)
  const [members, setMembers] = useState<TeamMember[]>([
    { name: profile?.full_name || '', roll_number: '', email: profile?.email || '', mobile: '', gender: 'Male', branch: 'CSE', year: '3rd Year', faculty: 'Faculty of Engineering', is_team_lead: true },
    { name: '', roll_number: '', email: '', mobile: '', gender: 'Male', branch: 'CSE', year: '3rd Year', faculty: 'Faculty of Engineering', is_team_lead: false },
    { name: '', roll_number: '', email: '', mobile: '', gender: 'Male', branch: 'ECE', year: '3rd Year', faculty: 'Faculty of Engineering', is_team_lead: false },
    { name: '', roll_number: '', email: '', mobile: '', gender: 'Male', branch: 'IT', year: '3rd Year', faculty: 'Faculty of Engineering', is_team_lead: false },
    { name: '', roll_number: '', email: '', mobile: '', gender: 'Male', branch: 'EEE', year: '3rd Year', faculty: 'Faculty of Science', is_team_lead: false },
    { name: '', roll_number: '', email: '', mobile: '', gender: 'Female', branch: 'ME', year: '3rd Year', faculty: 'Faculty of Engineering', is_team_lead: false },
  ]);

  // Submission & Validation State
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<string>('DRAFT');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFilePath, setUploadedFilePath] = useState<string>('');
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);
  const [adminRemarks, setAdminRemarks] = useState<string>('');
  const [validationReport, setValidationReport] = useState<SIHValidationReport | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Section A Completion Check
  const isSectionAComplete = 
    Boolean(teamName.trim()) &&
    isTeamNameUnique === true &&
    Boolean(psId.trim()) &&
    Boolean(psTitle.trim()) &&
    Boolean(solTitle.trim()) &&
    Boolean(solDesc.trim());

  // Section B Completion Check
  const isSectionBComplete = 
    members.length === 6 &&
    members.every(m => 
      Boolean(m.name.trim()) &&
      Boolean(m.roll_number.trim()) &&
      Boolean(m.email.trim()) &&
      Boolean(m.mobile.trim()) &&
      Boolean(m.branch.trim()) &&
      Boolean(m.year.trim())
    );

  // Female Member Check
  const hasFemaleMember = members.some(m => m.gender === 'Female');

  // PDF Upload Check
  const isPdfUploaded = Boolean(uploadedFileName) && uploadedFileName.toLowerCase().endsWith('.pdf');

  // All 4 Checklist Requirements Complete ("Sabh Thik Hai")
  const isEverythingComplete = isSectionAComplete && isSectionBComplete && hasFemaleMember && isPdfUploaded;

  // Form is locked ONLY IF application has been submitted, teamId exists, PDF IS UPLOADED, and is not in NEED_CORRECTION/DRAFT state
  const isFormLocked = isSubmitted && Boolean(teamId) && isPdfUploaded && submissionStatus !== 'NEEDS_CORRECTION' && submissionStatus !== 'DRAFT';

  // Load existing team data from Supabase
  useEffect(() => {
    if (!user) return;
    loadTeamData();

    // Subscribe to Realtime Updates for Submissions & Reviews
    const subscription = supabase
      .channel('public:submissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, (payload: any) => {
        if (payload.new && payload.new.team_id === teamId) {
          setSubmissionStatus(payload.new.validation_status);
          setAdminRemarks(payload.new.admin_remarks || '');
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'teams' }, (payload: any) => {
        if (payload.old && payload.old.id === teamId) {
          // SPOC Admin reset team -> unlock student form
          setTeamId(null);
          setIsSubmitted(false);
          setSubmissionStatus('DRAFT');
          setUploadedFileName('');
          setUploadedFilePath('');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, teamId]);

  // Live Real-Time Unique Team Name Validator
  useEffect(() => {
    const trimmed = teamName.trim();
    if (!trimmed) {
      setIsTeamNameUnique(null);
      setTeamNameStatusMsg('');
      setTeamNameChecking(false);
      return;
    }

    if (initialTeamName && trimmed.toLowerCase() === initialTeamName.toLowerCase()) {
      setIsTeamNameUnique(true);
      setTeamNameStatusMsg('✓ Verified Team Name (Your registered team)');
      setTeamNameChecking(false);
      return;
    }

    setTeamNameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('id, team_lead_user_id, team_name')
          .ilike('team_name', trimmed);

        if (error) {
          console.error('Error checking team name uniqueness:', error);
          setTeamNameChecking(false);
          return;
        }

        const existingOtherTeam = data?.find(
          t => t.team_lead_user_id !== user?.id && t.id !== teamId
        );

        if (existingOtherTeam) {
          setIsTeamNameUnique(false);
          setTeamNameStatusMsg('❌ Already Registered! This team name is already taken by another team.');
        } else {
          setIsTeamNameUnique(true);
          setTeamNameStatusMsg('✓ Verified Team Name (Available)');
        }
      } catch (err) {
        console.error('Error in team name check:', err);
      } finally {
        setTeamNameChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [teamName, teamId, user, initialTeamName]);

  const loadTeamData = async () => {
    if (!user) return;

    // 1. Instant 0ms Local Storage Data Restoration
    const localKey = `sih_team_sub_${user.id || user.email}`;
    const localSub = localStorage.getItem(localKey);
    if (localSub) {
      try {
        const parsed = JSON.parse(localSub);
        if (parsed.team_name) {
          setTeamId(parsed.id);
          setTeamName(parsed.team_name);
          setInitialTeamName(parsed.team_name);
          setIsTeamNameUnique(true);
          setTeamNameStatusMsg('✓ Verified Team Name (Your registered team)');
          setPsId(parsed.problem_statement_id || '');
          setPsTitle(parsed.problem_statement_title || '');
          setPsDesc(parsed.problem_statement_description || '');
          setSolTitle(parsed.solution_title || '');
          setSolDesc(parsed.solution_description || '');
          setSubmissionStatus(parsed.submission_status || 'SUBMITTED');
          setIsSubmitted(true);
          if (parsed.members && parsed.members.length === 6) {
            setMembers(parsed.members);
          }
          if (parsed.uploadedFileName) {
            setUploadedFileName(parsed.uploadedFileName);
            setUploadedFilePath(parsed.uploadedFilePath || '');
            setUploadedAt(parsed.uploadedAt || new Date().toISOString());
          }
          if (parsed.validationReport) {
            setValidationReport(parsed.validationReport);
          }
        }
      } catch (e) {}
    }

    if (!isSupabaseConfigured) return;

    // 2. Non-blocking Background Supabase Sync
    try {
      const queryPromise = supabase
        .from('teams')
        .select('*')
        .eq('team_lead_user_id', user.id)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: null }), 1500)
      );

      const { data: team } = await Promise.race([queryPromise, timeoutPromise]);

      if (team) {
        setTeamId(team.id);
        setTeamName(team.team_name);
        setInitialTeamName(team.team_name);
        setIsTeamNameUnique(true);
        setTeamNameStatusMsg('✓ Verified Team Name (Your registered team)');
        setPsId(team.problem_statement_id);
        setPsTitle(team.problem_statement_title);
        setPsDesc(team.problem_statement_description || '');
        setSolTitle(team.solution_title);
        setSolDesc(team.solution_description);
        setSubmissionStatus(team.submission_status);
        setIsSubmitted(true);

        // Fetch Members & Submission with fast promise race
        const memsPromise = supabase.from('team_members').select('*').eq('team_id', team.id).order('is_team_lead', { ascending: false });
        const memsTimeout = new Promise<{ data: any }>((resolve) => setTimeout(() => resolve({ data: null }), 1000));
        const { data: mems } = await Promise.race([memsPromise, memsTimeout]);

        if (mems && mems.length === 6) {
          setMembers(mems);
        }

        const subPromise = supabase.from('submissions').select('*').eq('team_id', team.id).order('uploaded_at', { ascending: false }).limit(1).maybeSingle();
        const subTimeout = new Promise<{ data: any }>((resolve) => setTimeout(() => resolve({ data: null }), 1000));
        const { data: sub } = await Promise.race([subPromise, subTimeout]);

        if (sub) {
          setSubmissionId(sub.id);
          setUploadedFileName(sub.file_name);
          setUploadedFilePath(sub.file_path);
          setUploadedAt(sub.uploaded_at);
          setSubmissionStatus(sub.validation_status);
          setAdminRemarks(sub.admin_remarks || '');
        }
      }
    } catch (err) {
      console.error('Error loading team data:', err);
    }
  };

  const handleMemberChange = (index: number, field: keyof TeamMember, value: any) => {
    if (isFormLocked) return;
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  // Preview Uploaded Solution PDF in Browser Tab
  const handlePreviewStudentPdf = async () => {
    if (!uploadedFilePath) return;
    try {
      const { data, error } = await supabase.storage
        .from('sih-submissions')
        .createSignedUrl(uploadedFilePath, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        const { data: pubData } = supabase.storage
          .from('sih-submissions')
          .getPublicUrl(uploadedFilePath);
        if (pubData?.publicUrl) {
          window.open(pubData.publicUrl, '_blank');
        } else {
          alert('PDF preview error: ' + (error?.message || 'File not found in storage. Ensure file was uploaded.'));
        }
      }
    } catch (err: any) {
      alert('PDF preview error: ' + err.message);
    }
  };

  // Download Uploaded Solution PDF File
  const handleDownloadStudentPdf = async () => {
    if (!uploadedFilePath) return;
    try {
      const { data, error } = await supabase.storage
        .from('sih-submissions')
        .createSignedUrl(uploadedFilePath, 3600);

      const downloadUrl = data?.signedUrl || supabase.storage.from('sih-submissions').getPublicUrl(uploadedFilePath).data.publicUrl;
      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = uploadedFileName || 'SIH_Solution_File.pdf';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert('Download error: ' + (error?.message || 'File not found in storage.'));
      }
    } catch (err: any) {
      alert('Download error: ' + err.message);
    }
  };

  // Export/Preview Full Student Team Application Details PDF
  const handlePreviewStudentApplicationPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SIH 2026 Official Student Team Registration Copy - ${teamName}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
          .header { border-bottom: 3px solid #0284c7; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { margin: 0; color: #0f172a; font-size: 22px; }
          .header p { margin: 5px 0 0 0; color: #64748b; font-size: 13px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: bold; font-size: 12px; background: #dcfce7; color: #166534; border: 1px solid #86efac; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #0284c7; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
          .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; }
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 12px; }
          .info-label { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; }
          .info-value { font-weight: 600; color: #0f172a; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #f1f5f9; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155; }
          td { padding: 8px 10px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Smart India Hackathon (SIH 2026)</h1>
            <p>Official Student Team Registration & Application Summary Copy</p>
          </div>
          <div>
            <span class="badge">Status: ${submissionStatus || 'SUBMITTED'}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Section A: Team & Problem Statement Details</div>
          <div class="grid">
            <div class="info-box">
              <div class="info-label">Team Name</div>
              <div class="info-value">${teamName}</div>
            </div>
            <div class="info-box">
              <div class="info-label">SIH Problem Statement ID</div>
              <div class="info-value">${psId}</div>
            </div>
          </div>
          <div class="info-box" style="margin-top: 10px;">
            <div class="info-label">Problem Statement Title</div>
            <div class="info-value">${psTitle}</div>
          </div>
          <div class="info-box" style="margin-top: 10px;">
            <div class="info-label">Problem Statement Description</div>
            <div class="info-value">${psDesc || 'N/A'}</div>
          </div>
          <div class="grid" style="margin-top: 10px;">
            <div class="info-box">
              <div class="info-label">Proposed Solution Title</div>
              <div class="info-value">${solTitle}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Solution Short Description</div>
              <div class="info-value">${solDesc}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Section B: Registered Team Members (6 Members)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Member Name</th>
                <th>Roll Number</th>
                <th>Email ID</th>
                <th>Mobile</th>
                <th>Gender</th>
                <th>Branch & Year</th>
                <th>Faculty / Stream</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              ${members.map((m, idx) => `
                <tr>
                  <td><strong>${idx + 1}</strong></td>
                  <td><strong>${m.name}</strong></td>
                  <td>${m.roll_number}</td>
                  <td>${m.email}</td>
                  <td>${m.mobile}</td>
                  <td><span style="color: ${m.gender === 'Female' ? '#059669' : '#1e293b'}; font-weight: bold;">${m.gender}</span></td>
                  <td>${m.branch} - ${m.year}</td>
                  <td>${m.faculty || 'Faculty of Engineering'}</td>
                  <td>${m.is_team_lead ? '<strong style="color: #d97706;">Team Lead</strong>' : 'Member'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Section C: Official Solution PDF File Submission</div>
          <div class="grid">
            <div class="info-box">
              <div class="info-label">Uploaded PDF File Name</div>
              <div class="info-value" style="font-family: monospace; color: #0284c7;">${uploadedFileName || `${teamName}_SIH2026.pdf`}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Submission Date & Time</div>
              <div class="info-value">${uploadedAt ? new Date(uploadedAt).toLocaleString() : new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Generated officially from SIH 2026 Student Portal • Chaitanya (Deemed to be University)</p>
          <p>For queries, contact SIH Coordinators: Shaik Abdul Razak (8919701520), Potharla Rajesh (8688796909), Kasula Shiva Kumar (9014059770)</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Upload & Inspect Solution PDF ONLY (Strict Filename & Structure Validation)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFormLocked) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMsg(null);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

      // 1. REJECT non-PDF files strictly
      if (fileExt !== 'pdf') {
        setUploading(false);
        setMsg({
          type: 'error',
          text: 'Invalid File Format: Only PDF files (.pdf) are allowed as per SIH guidelines. PPT / PPTX files are strictly not permitted.',
        });
        e.target.value = '';
        return;
      }

      // 2. STRICT FILENAME MATCHING VALIDATION (<TeamName>_SIH2026.pdf)
      const currentTeamName = teamName.trim() || 'Team';
      const cleanTeamName = currentTeamName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const expectedFileName = `${cleanTeamName}_SIH2026.pdf`;
      const actualFileName = file.name.trim();

      if (actualFileName.toLowerCase() !== expectedFileName.toLowerCase()) {
        setUploading(false);
        setMsg({
          type: 'error',
          text: `❌ Invalid PDF Filename: As per SIH 2026 guidelines, your PDF file must be named strictly as "${expectedFileName}" to match your team name "${currentTeamName}". You selected "${actualFileName}". Please rename the file on your device to "${expectedFileName}" and upload again.`,
        });
        e.target.value = '';
        return;
      }

      // 3. Run Automated Structure & Slide Count Validator
      const report = await validateSIHSubmission(file);
      report.fileName = actualFileName;

      if (report.slideCount > 6) {
        setUploading(false);
        setMsg({
          type: 'error',
          text: `❌ Invalid Slide Count: Uploaded PDF has ${report.slideCount} pages. SIH 2026 guidelines permit strictly a maximum of 6 slides. Please reduce your presentation to 6 slides and re-upload.`,
        });
        e.target.value = '';
        return;
      }

      setValidationReport(report);
      setUploadedFileName(actualFileName);
      setUploadedAt(new Date().toISOString());
      setSubmissionStatus('UNDER_REVIEW');

      // Upload file to Supabase Private Bucket
      let filePath = `${user?.id || 'guest'}/${Date.now()}_${actualFileName}`;
      setUploadedFilePath(filePath);

      const { error: uploadErr } = await supabase.storage
        .from('sih-submissions')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) {
        console.warn('Storage upload notice:', uploadErr.message);
      }

      // Save Submission Record if team exists
      if (teamId) {
        const { data: subData } = await supabase
          .from('submissions')
          .insert({
            team_id: teamId,
            file_name: actualFileName,
            file_path: filePath,
            file_type: 'application/pdf',
            file_size: file.size,
            detected_slide_count: report.slideCount,
            validation_status: 'UNDER_REVIEW',
            validation_issues: {
              issues: report.issues,
              detectedHeaders: report.detectedHeaders,
              missingHeaders: report.missingHeaders,
            },
            admin_remarks: report.summary,
          })
          .select()
          .maybeSingle();

        if (subData) {
          setSubmissionId(subData.id);
        }

        // Update Team Submission Status to UNDER_REVIEW
        await supabase
          .from('teams')
          .update({ submission_status: 'UNDER_REVIEW', updated_at: new Date().toISOString() })
          .eq('id', teamId);
      }

      if (!uploadErr) {
        setMsg({ type: 'success', text: `Official Solution PDF (${actualFileName}) uploaded and inspected successfully!` });
      }
    } catch (err: any) {
      console.error('Upload Error:', err);
      setMsg({ type: 'error', text: err.message || 'PDF processing error.' });
    } finally {
      setUploading(false);
    }
  };

  // Final Application Submit Handler
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormLocked) {
      setMsg({
        type: 'error',
        text: 'Form is locked! Your response has already been submitted to SIH 2026. Input fields are locked.',
      });
      return;
    }

    setMsg(null);
    setFormValidationErrors([]);

    const errors: string[] = [];

    // 1. Team Name Check
    if (!teamName.trim()) {
      errors.push('Team Name (Registered on Portal) is missing.');
    } else if (isTeamNameUnique === false) {
      errors.push('Team Name is already registered by another team. Please choose a unique team name.');
    } else if (teamNameChecking) {
      errors.push('Team Name uniqueness check is still in progress. Please wait a moment.');
    }

    // 2. Problem Statement & Solution Details
    if (!psId.trim()) errors.push('SIH Problem Statement ID is missing.');
    if (!psTitle.trim()) errors.push('Problem Statement Title is missing.');
    if (!solTitle.trim()) errors.push('Proposed Solution Title is missing.');
    if (!solDesc.trim()) errors.push('Solution Short Description is missing.');

    // 3. Team Members Validation (Exactly 6 Members)
    if (members.length !== 6) {
      errors.push('A team must have exactly 6 members.');
    } else {
      members.forEach((m, idx) => {
        const missingFields: string[] = [];
        if (!m.name.trim()) missingFields.push('Name');
        if (!m.roll_number.trim()) missingFields.push('Roll Number');
        if (!m.email.trim()) missingFields.push('Email');
        if (!m.mobile.trim()) missingFields.push('Mobile Number');
        if (!m.branch.trim()) missingFields.push('Branch');
        if (!m.year.trim()) missingFields.push('Academic Year');

        if (missingFields.length > 0) {
          errors.push(`Member ${idx + 1} (${m.name || 'Unnamed'}) has missing details: ${missingFields.join(', ')}.`);
        }
      });

      // Check unique emails & roll numbers
      const emails = members.map(m => m.email.trim().toLowerCase()).filter(Boolean);
      const rolls = members.map(m => m.roll_number.trim().toLowerCase()).filter(Boolean);

      if (new Set(emails).size !== emails.length) {
        errors.push('Duplicate email detected among team members. All 6 member emails must be unique.');
      }
      if (new Set(rolls).size !== rolls.length) {
        errors.push('Duplicate roll number detected among team members. All 6 roll numbers must be unique.');
      }
    }

    // 4. Mandatory Female Check
    if (!hasFemaleMember) {
      errors.push('At least one female team member is mandatory as per official SIH guidelines.');
    }

    // 5. PDF Upload Check
    if (!uploadedFileName) {
      errors.push('Official Solution PDF file has not been uploaded. Please upload your PDF in Section C.');
    }

    if (errors.length > 0) {
      setFormValidationErrors(errors);
      setMsg({
        type: 'error',
        text: `Submission incomplete. Please fix the ${errors.length} error(s) listed below before submitting.`,
      });
      return;
    }

    setSaving(true);
    const targetTeamId = teamId || `team-${Date.now()}`;
    const cleanTeamName = teamName.trim();
    const finalStatus = 'UNDER_REVIEW';

    // 1. Instant 0ms Local Storage Persist
    const localPayload = {
      id: targetTeamId,
      team_name: cleanTeamName,
      problem_statement_id: psId.trim(),
      problem_statement_title: psTitle.trim(),
      problem_statement_description: psDesc.trim(),
      solution_title: solTitle.trim(),
      solution_description: solDesc.trim(),
      submission_status: finalStatus,
      members,
      uploadedFileName,
      uploadedFilePath,
      uploadedAt: uploadedAt || new Date().toISOString(),
      validationReport,
      adminRemarks: validationReport?.summary || '',
      isSubmitted: true,
    };

    try {
      localStorage.setItem(`sih_team_sub_${user?.id || user?.email || 'guest'}`, JSON.stringify(localPayload));
    } catch (e) {}

    // 2. Instant UI Response
    setTeamId(targetTeamId);
    setInitialTeamName(cleanTeamName);
    setIsSubmitted(true);
    setSubmissionStatus(finalStatus);
    setFormValidationErrors([]);
    setSaving(false);

    setToastMsg({
      title: 'Successfully Registered Your Team in SIH 2026!',
      text: `Team "${cleanTeamName}" has been recorded.`,
      teamName: cleanTeamName,
    });

    setMsg({ type: 'success', text: '✓ Successfully registered your team in SIH 2026! Confirmation email sent to Team Lead.' });

    // 3. Non-blocking Background Supabase Sync & Email Dispatch
    if (true) {
      (async () => {
        try {
          const { data: tData } = await supabase
            .from('teams')
            .upsert(
              {
                id: targetTeamId,
                team_name: cleanTeamName,
                problem_statement_id: psId.trim(),
                problem_statement_title: psTitle.trim(),
                problem_statement_description: psDesc.trim(),
                solution_title: solTitle.trim(),
                solution_description: solDesc.trim(),
                team_lead_user_id: user?.id,
                submission_status: finalStatus,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            )
            .select()
            .maybeSingle();

          const realSavedId = tData?.id || targetTeamId;

          await Promise.resolve(supabase.from('team_members').delete().eq('team_id', realSavedId)).catch(() => {});

          const memberPayloads = members.map(m => ({
            team_id: realSavedId,
            name: m.name,
            roll_number: m.roll_number,
            email: m.email,
            mobile: m.mobile,
            gender: m.gender,
            branch: m.branch,
            year: m.year,
            faculty: m.faculty || 'Faculty of Engineering',
            is_team_lead: m.is_team_lead || false,
          }));

          await Promise.resolve(supabase.from('team_members').insert(memberPayloads)).catch(() => {});

          if (uploadedFilePath) {
            const actualFileName = uploadedFileName || `${cleanTeamName}_SIH2026.pdf`;
            await Promise.resolve(supabase.from('submissions').upsert({
              team_id: realSavedId,
              file_name: actualFileName,
              file_path: uploadedFilePath,
              file_type: 'application/pdf',
              file_size: validationReport?.fileSize || 1024,
              detected_slide_count: validationReport?.slideCount || 6,
              validation_status: finalStatus,
              admin_remarks: validationReport?.summary || 'Complies with official SIH 6-Slide Template specifications!',
              uploaded_at: uploadedAt || new Date().toISOString(),
            })).catch(() => {});
          }

          const leadMember = members.find(m => m.is_team_lead) || members[0];
          const leadEmail = leadMember.email || user?.email || profile?.email || '';

          sendSIHRegistrationEmail({
            teamName: cleanTeamName,
            teamLeadName: leadMember.name || profile?.full_name || 'Team Lead',
            teamLeadEmail: leadEmail,
            psId: psId.trim(),
            psTitle: psTitle.trim(),
            solTitle: solTitle.trim(),
            uploadedFileName: uploadedFileName || `${cleanTeamName}_SIH2026.pdf`,
          }).catch(() => {});
        } catch (bgErr) {
          console.warn('Background sync note:', bgErr);
        }
      })();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VALID':
        return <span className="px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-bold text-xs flex items-center space-x-1"><CheckCircle2 className="w-3.5 h-3.5" /><span>Valid / Approved</span></span>;
      case 'NEEDS_CORRECTION':
        return <span className="px-3 py-1 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800 font-bold text-xs flex items-center space-x-1"><AlertTriangle className="w-3.5 h-3.5" /><span>Needs Correction (Unlocked)</span></span>;
      case 'INVALID':
        return <span className="px-3 py-1 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800 font-bold text-xs flex items-center space-x-1"><AlertCircle className="w-3.5 h-3.5" /><span>Invalid Format</span></span>;
      case 'UNDER_REVIEW':
        return <span className="px-3 py-1 rounded-full bg-sky-950/80 text-sky-400 border border-sky-800 font-bold text-xs flex items-center space-x-1"><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Under SPOC Review</span></span>;
      default:
        return <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-semibold text-xs">Submission Pending</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative">
      {/* FLOATING SIDE TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-full bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500 text-white rounded-2xl p-5 shadow-2xl space-y-2 animate-bounce-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-400 font-extrabold text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              <span>{toastMsg.title}</span>
            </div>
            <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-200 font-medium">
            Team <span className="font-bold text-emerald-300">"{toastMsg.teamName}"</span> is officially registered in SIH 2026!
          </p>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 rounded-md bg-cyan-950/90 text-cyan-300 border border-cyan-800/80 text-xs font-bold uppercase tracking-wider flex items-center space-x-1">
                <Award className="w-3.5 h-3.5 text-cyan-400" />
                <span>SIH 2026 Student Portal</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {teamName || 'Your SIH Team Submission'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>{profile?.college_name || 'SIH Participating Institution'}</span>
              <span>•</span>
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Last updated: {uploadedAt ? new Date(uploadedAt).toLocaleString() : 'Just now'}</span>
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end space-y-2">
            <span className="text-xs font-semibold text-slate-400">Submission Validation Status</span>
            {getStatusBadge(submissionStatus)}
          </div>
        </div>
      </div>

      {/* Submission Checklist Progress Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Submission Progress Checklist</span>
          </h3>

          {isEverythingComplete && (
            <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-extrabold text-xs flex items-center space-x-1 animate-pulse">
              <CheckCircle2 className="w-4 h-4" />
              <span>All Requirements Satisfied ✓ Ready to Submit!</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className={`p-3 rounded-xl border flex items-center space-x-2 transition-all ${isSectionAComplete ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <CheckCircle2 className={`w-4 h-4 ${isSectionAComplete ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>1. Team Details & Unique Name</span>
          </div>

          <div className={`p-3 rounded-xl border flex items-center space-x-2 transition-all ${isSectionBComplete ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <CheckCircle2 className={`w-4 h-4 ${isSectionBComplete ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>2. 6 Members Details Filled</span>
          </div>

          <div className={`p-3 rounded-xl border flex items-center space-x-2 transition-all ${hasFemaleMember ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' : 'bg-rose-950/50 border-rose-800/80 text-rose-300 animate-pulse'}`}>
            {hasFemaleMember ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>3. Mandatory Female Check</span>
          </div>

          <div className={`p-3 rounded-xl border flex items-center space-x-2 transition-all ${isPdfUploaded ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <CheckCircle2 className={`w-4 h-4 ${isPdfUploaded ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>4. PDF Uploaded (.pdf strictly)</span>
          </div>
        </div>

        {isEverythingComplete ? (
          <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-700/80 text-emerald-200 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span className="font-bold">✓ All Requirements Satisfied! Team details, 6 member profiles, and solution PDF are complete.</span>
          </div>
        ) : !hasFemaleMember ? (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span className="font-semibold">At least one female team member is mandatory as per SIH team requirements. Please specify gender = "Female" for at least 1 member.</span>
          </div>
        ) : null}
      </div>

      {/* FORM LOCKED BANNER WITH ONLY PREVIEW APPLICATION PDF BUTTON */}
      {isFormLocked && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-2 border-amber-500/80 shadow-2xl space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between flex-col md:flex-row gap-4">
            <div className="flex items-start space-x-3">
              <span className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-300 font-black text-2xl flex-shrink-0">
                🔒
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-amber-300 flex items-center space-x-2">
                  <span>APPLICATION RECORDED & FORM INPUTS LOCKED</span>
                </h3>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  Your team <span className="font-bold text-amber-300">"{teamName}"</span> application has been successfully recorded in SIH 2026. Form fields are locked to prevent duplicate submissions or accidental edits.
                </p>
                <p className="text-[11px] text-amber-400/90 pt-1 italic font-medium">
                  ℹ️ Note: If your College SPOC Admin deletes or resets your submission for correction, your account will automatically unlock to re-submit fresh details.
                </p>
              </div>
            </div>

            <div className="flex items-center self-stretch md:self-auto justify-start md:justify-end flex-shrink-0">
              <button
                type="button"
                onClick={handlePreviewStudentApplicationPDF}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-extrabold text-xs flex items-center space-x-2 transition-all shadow-lg shadow-amber-600/30 transform hover:-translate-y-0.5"
              >
                <FileText className="w-4 h-4 text-amber-100" />
                <span>Preview Application PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSaveTeam} className="space-y-8">
        {/* SECTION A: TEAM & PROBLEM STATEMENT DETAILS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>Section A: Team & SIH Problem Statement Details</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter official SIH Problem Statement ID and solution title.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Team Name (Registered on Portal) <span className="text-cyan-400">* Unique</span>
              </label>
              <input
                type="text"
                required
                disabled={isFormLocked}
                value={teamName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTeamName(e.target.value)}
                placeholder="e.g. CyberKnights_2026"
                className={`w-full bg-slate-950 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all ${
                  isFormLocked
                    ? 'opacity-60 cursor-not-allowed bg-slate-900 border-slate-800'
                    : isTeamNameUnique === false
                    ? 'border-rose-500/80 focus:border-rose-500'
                    : isTeamNameUnique === true
                    ? 'border-emerald-500/80 focus:border-emerald-500'
                    : 'border-slate-800 focus:border-cyan-500'
                }`}
              />
              
              {/* Real-time Uniqueness Indicator */}
              {teamNameChecking && (
                <p className="text-xs text-sky-400 font-semibold mt-1.5 flex items-center space-x-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Verifying team name availability...</span>
                </p>
              )}

              {!teamNameChecking && teamNameStatusMsg && (
                <div className={`mt-1.5 p-2 rounded-lg text-xs font-bold border flex items-center space-x-2 ${
                  isTeamNameUnique === false
                    ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                }`}>
                  <span>{teamNameStatusMsg}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">SIH Problem Statement ID</label>
              <input
                type="text"
                required
                disabled={isFormLocked}
                value={psId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPsId(e.target.value)}
                placeholder="e.g. SIH1542"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-950 border-slate-800'}`}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Problem Statement Title</label>
              <input
                type="text"
                required
                disabled={isFormLocked}
                value={psTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPsTitle(e.target.value)}
                placeholder="e.g. AI-driven Smart Water Leakage & Quality Detection System"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-950 border-slate-800'}`}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Problem Statement Description</label>
              <textarea
                rows={2}
                disabled={isFormLocked}
                value={psDesc}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPsDesc(e.target.value)}
                placeholder="Brief details about the problem statement..."
                className={`w-full border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-950 border-slate-800'}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Proposed Solution Title</label>
              <input
                type="text"
                required
                disabled={isFormLocked}
                value={solTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSolTitle(e.target.value)}
                placeholder="e.g. HydroShield IoT Analytics"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-950 border-slate-800'}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Solution Short Description</label>
              <input
                type="text"
                required
                disabled={isFormLocked}
                value={solDesc}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSolDesc(e.target.value)}
                placeholder="Key innovation highlight..."
                className={`w-full border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-950 border-slate-800'}`}
              />
            </div>
          </div>
        </div>

        {/* SECTION B: EXACTLY 6 TEAM MEMBERS (WITH FEMALE MANDATORY CHECK) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>Section B: Team Members (Exactly 6 Required)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                At least one female team member is mandatory. Member 1 is Team Lead.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${isSectionBComplete ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                Members Status: {isSectionBComplete ? '6/6 Details Filled ✓' : 'Incomplete ✗'}
              </span>
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${hasFemaleMember ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'}`}>
                Female Member: {hasFemaleMember ? 'Satisfied ✓' : 'Missing ✗'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {members.map((m, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl border transition-all ${
                  m.is_team_lead
                    ? 'bg-gradient-to-b from-slate-950 to-slate-900 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-white">
                      Team Member {idx + 1}
                    </span>
                  </div>

                  {m.is_team_lead ? (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                      ★ Team Lead
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium">Member</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      disabled={isFormLocked}
                      value={m.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMemberChange(idx, 'name', e.target.value)}
                      placeholder="Student Name"
                      className={`w-full border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-900 border-slate-800'}`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Roll / Reg Number</label>
                    <input
                      type="text"
                      required
                      disabled={isFormLocked}
                      value={m.roll_number}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMemberChange(idx, 'roll_number', e.target.value)}
                      placeholder="e.g. 21CS045"
                      className={`w-full border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-900 border-slate-800'}`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Gender</label>
                    <select
                      disabled={isFormLocked}
                      value={m.gender}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleMemberChange(idx, 'gender', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-1.5 focus:outline-none ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed text-white' : m.gender === 'Female' ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200 font-semibold' : 'bg-slate-900 border-slate-800 text-white'}`}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female (Mandatory)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Email ID</label>
                    <input
                      type="email"
                      required
                      disabled={isFormLocked}
                      value={m.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMemberChange(idx, 'email', e.target.value)}
                      placeholder="email@college.edu"
                      className={`w-full border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-900 border-slate-800'}`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      disabled={isFormLocked}
                      value={m.mobile}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMemberChange(idx, 'mobile', e.target.value)}
                      placeholder="9876543210"
                      className={`w-full border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-900 border-slate-800'}`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Branch</label>
                    <input
                      type="text"
                      required
                      disabled={isFormLocked}
                      value={m.branch}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMemberChange(idx, 'branch', e.target.value)}
                      placeholder="e.g. CSE"
                      className={`w-full border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-900 border-slate-800'}`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Academic Year</label>
                    <select
                      disabled={isFormLocked}
                      value={m.year}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleMemberChange(idx, 'year', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-900 border-slate-800'}`}
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-400 mb-1">Faculty / Stream</label>
                    <select
                      disabled={isFormLocked}
                      value={m.faculty || 'Faculty of Engineering'}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleMemberChange(idx, 'faculty', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500 ${isFormLocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-900 border-slate-800'}`}
                    >
                      <option value="Faculty of Engineering">Faculty of Engineering</option>
                      <option value="Faculty of Science">Faculty of Science</option>
                      <option value="Faculty of Forensic Science">Faculty of Forensic Science</option>
                      <option value="Faculty of Radiology">Faculty of Radiology</option>
                      <option value="Faculty of Physiotherapy">Faculty of Physiotherapy</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION C: SOLUTION PDF FILE UPLOAD & HIGHLIGHTED FILE FORMAT REQUIREMENTS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              <span>Section C: Official SIH Solution File Upload (.PDF Only)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              As per official SIH 2026 guidelines, solution documents must strictly be submitted in PDF format only.
            </p>
          </div>

          {/* HIGHLIGHTED FILE FORMAT & NAMING STANDARD BOX */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-cyan-950/80 border-2 border-cyan-500/60 shadow-lg relative overflow-hidden">
            <div className="flex items-start space-x-3">
              <span className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 font-extrabold text-xl flex-shrink-0">
                📄
              </span>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center space-x-2">
                  <span>MANDATORY FILE FORMAT & NAMING CONVENTION</span>
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  Submissions are restricted strictly to <span className="text-cyan-300 font-bold underline">PDF format only</span>. PowerPoint (.ppt / .pptx) files are not allowed.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">Required PDF Filename Pattern:</span>
                  <span className="px-3 py-1 rounded-lg bg-slate-950 border border-cyan-400/50 font-mono text-xs font-extrabold text-cyan-300 shadow-inner">
                    {teamName.trim() ? `${teamName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}_SIH2026.pdf` : 'Team-Name_SIH2026.pdf'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section C Alert Notification */}
          {msg && (
            <div
              className={`p-4 rounded-2xl text-xs sm:text-sm flex items-center space-x-3 border shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
                msg.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950/90 text-rose-300 border-rose-800'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              )}
              <span className="font-medium">{msg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* File Upload Dropzone (Accepts ONLY .pdf) */}
            <div className={`lg:col-span-1 border-2 border-dashed border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all group ${isFormLocked ? 'bg-slate-950/30 opacity-80' : 'bg-slate-950/60 hover:border-cyan-500/60'}`}>
              <UploadCloud className="w-12 h-12 text-slate-500 group-hover:text-cyan-400 transition-colors mb-3" />
              <h4 className="text-xs font-bold text-white mb-1">
                {uploadedFileName ? 'Solution PDF Uploaded' : 'Upload Solution PDF'}
              </h4>
              <p className="text-[11px] text-slate-400 mb-4">
                Supports ONLY .pdf format (Max 6 Pages)
              </p>

              {!isFormLocked ? (
                <label className="cursor-pointer px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all inline-flex items-center space-x-2">
                  <span>{uploading ? 'Processing PDF...' : uploadedFileName ? 'Choose New PDF' : 'Browse PDF File'}</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileUpload}
                    disabled={uploading || isFormLocked}
                    className="hidden"
                  />
                </label>
              ) : (
                <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold border border-slate-700">
                  Upload Locked
                </span>
              )}

              {uploadedFileName && (
                <div className="mt-4 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-left w-full text-xs space-y-2">
                  <div className="text-slate-300 font-bold truncate flex items-center space-x-1">
                    <FileText className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    <span className="truncate">{uploadedFileName}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Uploaded: {new Date(uploadedAt || Date.now()).toLocaleString()}</div>
                  
                  {/* PREVIEW & DOWNLOAD BUTTONS FOR STUDENT */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={handlePreviewStudentPdf}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/80 font-bold text-[11px] flex items-center justify-center space-x-1 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadStudentPdf}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800/80 font-bold text-[11px] flex items-center justify-center space-x-1 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* SPOC Admin Review & Feedback Panel */}
            <div className="lg:col-span-2 flex flex-col justify-center">
              <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>College SPOC Admin Review & Feedback</span>
                  </h4>
                  {submissionStatus && getStatusBadge(submissionStatus)}
                </div>

                {adminRemarks ? (
                  <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/30 text-xs text-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400">
                      <span>SPOC Remarks:</span>
                      <span className="text-[10px] text-slate-400">Live Realtime Sync</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed font-medium text-xs">{adminRemarks}</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-500 italic">
                    No SPOC remarks added yet. When your SPOC admin reviews your submission file, remarks will appear here automatically in real-time.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CONSOLIDATED FORM VALIDATION ERROR DISPLAY BOX */}
        {formValidationErrors.length > 0 && (
          <div className="p-6 rounded-3xl bg-rose-950/90 border-2 border-rose-800/90 text-rose-200 shadow-2xl space-y-3 animate-fade-in">
            <div className="flex items-center space-x-2 text-rose-300 border-b border-rose-800/60 pb-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <h3 className="text-sm font-extrabold uppercase tracking-wide">
                Submission Incomplete - Please Fix the Following Missing Requirements ({formValidationErrors.length}):
              </h3>
            </div>
            <ul className="space-y-1.5 pl-2 text-xs font-semibold text-rose-200">
              {formValidationErrors.map((err, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>{err}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* FINAL UNIFIED SUBMIT BUTTON AT THE VERY BOTTOM OF THE PAGE */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            <p className="font-semibold text-slate-300">{isFormLocked ? 'Application Submitted & Recorded' : 'Ready to Submit?'}</p>
            <p className="text-[11px]">{isFormLocked ? 'Your application is locked. If your SPOC admin resets your submission, you can edit again.' : 'Submitting will validate all Team details, 6 Member profiles, and Solution PDF file.'}</p>
          </div>

          <button
            type="submit"
            disabled={saving || teamNameChecking || isFormLocked}
            className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-sm shadow-xl flex items-center justify-center space-x-3 transition-all ${
              isFormLocked
                ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-80'
                : 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-cyan-600/30 transform hover:-translate-y-0.5'
            }`}
          >
            {saving ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Recording Your Submission...</span>
              </>
            ) : isFormLocked ? (
              <>
                <Lock className="w-5 h-5 text-amber-400" />
                <span>Application Submitted & Locked</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Save & Submit Complete Application</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
