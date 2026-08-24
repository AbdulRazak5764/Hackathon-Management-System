import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { validateSIHSubmission, SIHValidationReport } from '../../utils/sihValidator';
import { 
  Users, UploadCloud, CheckCircle2, AlertCircle, AlertTriangle, FileText, 
  Award, Shield, Calendar, RefreshCw, ArrowUpRight, HelpCircle, Layers, Sparkles
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
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);
  const [adminRemarks, setAdminRemarks] = useState<string>('');
  const [validationReport, setValidationReport] = useState<SIHValidationReport | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Female Member Check
  const hasFemaleMember = members.some(m => m.gender === 'Female');

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
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, teamId]);

  const loadTeamData = async () => {
    if (!user) return;
    try {
      const { data: team, error: teamErr } = await supabase
        .from('teams')
        .select('*')
        .eq('team_lead_user_id', user.id)
        .maybeSingle();

      if (team) {
        setTeamId(team.id);
        setTeamName(team.team_name);
        setPsId(team.problem_statement_id);
        setPsTitle(team.problem_statement_title);
        setPsDesc(team.problem_statement_description || '');
        setSolTitle(team.solution_title);
        setSolDesc(team.solution_description);
        setSubmissionStatus(team.submission_status);
        setIsSubmitted(true);

        // Fetch Members
        const { data: mems } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', team.id)
          .order('is_team_lead', { ascending: false });

        if (mems && mems.length === 6) {
          setMembers(mems);
        }

        // Fetch Submission
        const { data: sub } = await supabase
          .from('submissions')
          .select('*')
          .eq('team_id', team.id)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub) {
          setSubmissionId(sub.id);
          setUploadedFileName(sub.file_name);
          setUploadedAt(sub.uploaded_at);
          setSubmissionStatus(sub.validation_status);
          setAdminRemarks(sub.admin_remarks || '');
          if (sub.validation_issues) {
            setValidationReport({
              fileName: sub.file_name,
              fileSize: sub.file_size,
              fileType: sub.file_name.endsWith('.pdf') ? 'pdf' : 'pptx',
              slideCount: sub.detected_slide_count || 6,
              maxAllowedSlides: 6,
              status: sub.validation_status as any,
              issues: sub.validation_issues.issues || [],
              detectedHeaders: sub.validation_issues.detectedHeaders || [],
              missingHeaders: sub.validation_issues.missingHeaders || [],
              summary: sub.admin_remarks || 'Document inspection recorded.',
            });
          }
        }
      }
    } catch (err) {
      console.error('Error loading team data:', err);
    }
  };

  const handleMemberChange = (index: number, field: keyof TeamMember, value: any) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  // Save Team Form & Members via RPC
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    // Frontend validations
    if (members.length !== 6) {
      setMsg({ type: 'error', text: 'Validation Error: A team must have exactly 6 members.' });
      return;
    }

    if (!hasFemaleMember) {
      setMsg({ type: 'error', text: 'At least one female team member is mandatory as per SIH team requirements.' });
      return;
    }

    // Check duplicate emails/roll numbers
    const emails = members.map(m => m.email.trim().toLowerCase());
    const rolls = members.map(m => m.roll_number.trim().toLowerCase());

    if (new Set(emails).size !== 6) {
      setMsg({ type: 'error', text: 'Duplicate email detected among team members. All emails must be unique.' });
      return;
    }

    if (new Set(rolls).size !== 6) {
      setMsg({ type: 'error', text: 'Duplicate roll number detected among team members. All roll numbers must be unique.' });
      return;
    }

    setSaving(true);

    try {
      let savedId: string | null = null;

      // 1. Try Supabase RPC for Atomic Save
      const { data: rpcTeamId, error: rpcErr } = await supabase.rpc('save_team_with_members', {
        p_team_name: teamName,
        p_ps_id: psId,
        p_ps_title: psTitle,
        p_ps_desc: psDesc,
        p_sol_title: solTitle,
        p_sol_desc: solDesc,
        p_members: members,
      });

      if (!rpcErr && rpcTeamId) {
        savedId = rpcTeamId;
      } else {
        // 2. Direct Supabase Query Fallback if RPC function is missing from schema cache
        const { data: tData, error: tErr } = await supabase
          .from('teams')
          .upsert({
            ...(teamId ? { id: teamId } : {}),
            team_name: teamName,
            problem_statement_id: psId,
            problem_statement_title: psTitle,
            problem_statement_description: psDesc,
            solution_title: solTitle,
            solution_description: solDesc,
            team_lead_user_id: user?.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'team_lead_user_id' })
          .select()
          .single();

        if (tErr) throw tErr;
        savedId = tData.id;

        // Delete old members for team and insert 6 updated members
        await supabase.from('team_members').delete().eq('team_id', savedId);

        const memberPayloads = members.map(m => ({
          team_id: savedId,
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

        const { error: memErr } = await supabase.from('team_members').insert(memberPayloads);

        if (memErr) {
          // Fallback if 'faculty' column does not exist in Supabase DB schema yet
          const fallbackPayloads = members.map(m => ({
            team_id: savedId,
            name: m.name,
            roll_number: m.roll_number,
            email: m.email,
            mobile: m.mobile,
            gender: m.gender,
            branch: m.branch,
            year: m.year,
            is_team_lead: m.is_team_lead || false,
          }));
          const { error: memErr2 } = await supabase.from('team_members').insert(fallbackPayloads);
          if (memErr2) throw memErr2;
        }
      }

      setTeamId(savedId);
      setIsSubmitted(true);
      setMsg({ type: 'success', text: '✓ Submitted Successfully! Your team details and 6 member profiles have been recorded.' });
    } catch (err: any) {
      console.error('Save Team Error:', err);
      let errMsg = err.message || 'Failed to save team details.';
      if (errMsg.toLowerCase().includes('schema cache') || errMsg.toLowerCase().includes('public.teams')) {
        errMsg = 'Database Setup Required: Database tables do not exist in your Supabase project yet. Please run supabase_schema.sql in your Supabase SQL Editor (https://supabase.com/dashboard/project/gcutaskxofmwgahnogmo/sql/new).';
      }
      setMsg({ type: 'error', text: errMsg });
    } finally {
      setSaving(false);
    }
  };

  // Upload & Inspect PPT/PDF
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMsg(null);

    try {
      // 1. Format file name as TeamName_SIH@2026.ext
      const cleanTeamName = (teamName.trim() || 'Team').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileExt = file.name.split('.').pop() || 'pdf';
      const standardizedFileName = `${cleanTeamName}_SIH@2026.${fileExt}`;

      // 2. Run Automated PDF/PPTX Structure Validator IMMEDIATELY
      const report = await validateSIHSubmission(file);
      report.fileName = standardizedFileName;
      setValidationReport(report);
      setUploadedFileName(standardizedFileName);
      setUploadedAt(new Date().toISOString());
      setSubmissionStatus(report.status);

      // 3. Ensure Team Record exists in DB (auto-create draft if not created yet)
      let currentTeamId = teamId;
      if (!currentTeamId && user) {
        const { data: newTeam } = await supabase
          .from('teams')
          .insert({
            team_name: teamName || `Team_${profile?.full_name || 'Lead'}_${Date.now().toString().slice(-4)}`,
            problem_statement_id: psId || 'SIH1542',
            problem_statement_title: psTitle || 'SIH Problem Statement',
            solution_title: solTitle || 'Proposed Solution',
            solution_description: solDesc || 'Solution Description',
            team_lead_user_id: user.id,
            submission_status: report.status,
          })
          .select()
          .maybeSingle();

        if (newTeam) {
          currentTeamId = newTeam.id;
          setTeamId(newTeam.id);
        }
      }

      // 4. Upload file to Supabase Private Bucket (with fallback handling)
      let filePath = `${user?.id || 'guest'}/${Date.now()}_${standardizedFileName}`;
      const { error: uploadErr } = await supabase.storage
        .from('sih-submissions')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) {
        console.warn('Storage upload notice:', uploadErr.message);
        setMsg({ 
          type: 'error', 
          text: `File inspected! Notice: Supabase storage bucket needs schema setup (${uploadErr.message}). Run supabase_schema.sql in Supabase SQL Editor.` 
        });
      }

      // 4. Save Submission Record if team exists
      if (currentTeamId) {
        const { data: subData } = await supabase
          .from('submissions')
          .insert({
            team_id: currentTeamId,
            file_name: standardizedFileName,
            file_path: filePath,
            file_type: file.type || 'application/pdf',
            file_size: file.size,
            detected_slide_count: report.slideCount,
            validation_status: report.status,
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

        // Update Team Submission Status
        await supabase
          .from('teams')
          .update({ submission_status: report.status, updated_at: new Date().toISOString() })
          .eq('id', currentTeamId);
      }

      if (!uploadErr) {
        setMsg({ type: 'success', text: `SIH Solution File (${file.name}) uploaded & inspected successfully!` });
      }
    } catch (err: any) {
      console.error('Upload Error:', err);
      setMsg({ type: 'error', text: err.message || 'File processing error.' });
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VALID':
        return <span className="px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-bold text-xs flex items-center space-x-1"><CheckCircle2 className="w-3.5 h-3.5" /><span>Valid / Approved</span></span>;
      case 'NEEDS_CORRECTION':
        return <span className="px-3 py-1 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800 font-bold text-xs flex items-center space-x-1"><AlertTriangle className="w-3.5 h-3.5" /><span>Needs Correction</span></span>;
      case 'INVALID':
        return <span className="px-3 py-1 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800 font-bold text-xs flex items-center space-x-1"><AlertCircle className="w-3.5 h-3.5" /><span>Invalid Format</span></span>;
      case 'UNDER_REVIEW':
        return <span className="px-3 py-1 rounded-full bg-sky-950/80 text-sky-400 border border-sky-800 font-bold text-xs flex items-center space-x-1"><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Under SPOC Review</span></span>;
      default:
        return <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-semibold text-xs">Submission Pending</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-medium">
                Lead: {profile?.full_name}
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

      {/* Alert Messages */}
      {msg && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm flex items-center space-x-3 border shadow-lg ${
            msg.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              : 'bg-rose-950/80 text-rose-300 border-rose-800'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <span className="font-medium">{msg.text}</span>
        </div>
      )}

      {/* Submission Checklist Progress Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Submission Progress Checklist</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className={`p-3 rounded-xl border flex items-center space-x-2 ${teamName ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <CheckCircle2 className={`w-4 h-4 ${teamName ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>1. Team Details</span>
          </div>

          <div className={`p-3 rounded-xl border flex items-center space-x-2 ${members.length === 6 ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <CheckCircle2 className={`w-4 h-4 ${members.length === 6 ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>2. Exactly 6 Members</span>
          </div>

          <div className={`p-3 rounded-xl border flex items-center space-x-2 ${hasFemaleMember ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' : 'bg-rose-950/50 border-rose-800/80 text-rose-300 animate-pulse'}`}>
            {hasFemaleMember ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>3. Mandatory Female Check</span>
          </div>

          <div className={`p-3 rounded-xl border flex items-center space-x-2 ${uploadedFileName ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <CheckCircle2 className={`w-4 h-4 ${uploadedFileName ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>4. PPT/PDF Uploaded</span>
          </div>
        </div>

        {!hasFemaleMember && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span className="font-semibold">At least one female team member is mandatory as per SIH team requirements. Please specify gender = "Female" for at least 1 member.</span>
          </div>
        )}
      </div>

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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Team Name (Registered on Portal)</label>
              <input
                type="text"
                required
                value={teamName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTeamName(e.target.value)}
                placeholder="e.g. CyberKnights_2026"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">SIH Problem Statement ID</label>
              <input
                type="text"
                required
                value={psId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPsId(e.target.value)}
                placeholder="e.g. SIH1542"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Problem Statement Title</label>
              <input
                type="text"
                required
                value={psTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPsTitle(e.target.value)}
                placeholder="e.g. AI-driven Smart Water Leakage & Quality Detection System"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Problem Statement Description</label>
              <textarea
                rows={2}
                value={psDesc}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPsDesc(e.target.value)}
                placeholder="Brief details about the problem statement..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Proposed Solution Title</label>
              <input
                type="text"
                required
                value={solTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSolTitle(e.target.value)}
                placeholder="e.g. HydroShield IoT Analytics"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Solution Short Description</label>
              <input
                type="text"
                required
                value={solDesc}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSolDesc(e.target.value)}
                placeholder="Key innovation highlight..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
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
              <span className="text-xs px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                Members: 6 / 6
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
                      value={m.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMemberChange(idx, 'name', e.target.value)}
                      placeholder="Student Name"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Roll / Reg Number</label>
                    <input
                      type="text"
                      required
                      value={m.roll_number}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMemberChange(idx, 'roll_number', e.target.value)}
                      placeholder="e.g. 21CS045"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Gender</label>
                    <select
                      value={m.gender}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleMemberChange(idx, 'gender', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-1.5 focus:outline-none ${m.gender === 'Female' ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200 font-semibold' : 'bg-slate-900 border-slate-800 text-white'}`}
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
                      value={m.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMemberChange(idx, 'email', e.target.value)}
                      placeholder="email@college.edu"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      value={m.mobile}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMemberChange(idx, 'mobile', e.target.value)}
                      placeholder="9876543210"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Branch</label>
                    <input
                      type="text"
                      required
                      value={m.branch}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMemberChange(idx, 'branch', e.target.value)}
                      placeholder="e.g. CSE"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">Academic Year</label>
                    <select
                      value={m.year}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleMemberChange(idx, 'year', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
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
                      value={m.faculty || 'Faculty of Engineering'}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleMemberChange(idx, 'faculty', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
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

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Saving Team Records...' : 'Save Team Details & Members'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* SECTION C: SOLUTION PPT / PDF FILE UPLOAD & FORMAT VALIDATOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>Section C: Official SIH Solution File Upload (.PDF / .PPTX)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            As per official SIH 2026 guidelines, presentations must follow the 6-slide template. PDF format is recommended.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Upload Dropzone */}
          <div className="lg:col-span-1 border-2 border-dashed border-slate-800 hover:border-cyan-500/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-950/60 transition-all group">
            <UploadCloud className="w-12 h-12 text-slate-500 group-hover:text-cyan-400 transition-colors mb-3" />
            <h4 className="text-xs font-bold text-white mb-1">
              {uploadedFileName ? 'Replace Uploaded Solution' : 'Upload Solution PPT / PDF'}
            </h4>
            <p className="text-[11px] text-slate-400 mb-4">
              Supports .pdf and .pptx (Max 6 Slides)
            </p>

            <label className="cursor-pointer px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all inline-flex items-center space-x-2">
              <span>{uploading ? 'Processing File...' : uploadedFileName ? 'Choose New File' : 'Browse File'}</span>
              <input
                type="file"
                accept=".pdf,.pptx,.ppt"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {uploadedFileName && (
              <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800 text-left w-full text-xs space-y-1">
                <div className="text-slate-400 font-semibold truncate">{uploadedFileName}</div>
                <div className="text-[10px] text-slate-500">Uploaded: {new Date(uploadedAt || Date.now()).toLocaleString()}</div>
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
    </div>
  );
};
