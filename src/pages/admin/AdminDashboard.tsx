import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, FileText, 
  Search, Filter, Download, ShieldCheck, X, Eye, MessageSquare, ArrowUpDown, Layers, Sparkles
} from 'lucide-react';

export interface AdminTeamRecord {
  id: string;
  team_name: string;
  problem_statement_id: string;
  problem_statement_title: string;
  problem_statement_description: string;
  solution_title: string;
  solution_description: string;
  team_lead_user_id: string;
  submission_status: string;
  created_at: string;
  updated_at: string;
  team_members?: any[];
  submission?: any;
  has_female_member?: boolean;
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<AdminTeamRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [femaleFilter, setFemaleFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'name'>('latest');

  // Selected Team for Drawer Review
  const [selectedTeam, setSelectedTeam] = useState<AdminTeamRecord | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>('UNDER_REVIEW');
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [savingReview, setSavingReview] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchAdminDashboardData();

    // Supabase Realtime channel for live updates
    const subscription = supabase
      .channel('admin-teams-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchAdminDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        fetchAdminDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchAdminDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all teams
      const { data: teamsData, error: tErr } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (tErr) throw tErr;

      // 2. Fetch all members and latest submissions
      const fullTeams: AdminTeamRecord[] = await Promise.all(
        (teamsData || []).map(async (t) => {
          const { data: mems } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', t.id);

          const { data: sub } = await supabase
            .from('submissions')
            .select('*')
            .eq('team_id', t.id)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const hasFemale = (mems || []).some((m: any) => m.gender === 'Female');

          return {
            ...t,
            team_members: mems || [],
            submission: sub || null,
            has_female_member: hasFemale,
          };
        })
      );

      setTeams(fullTeams);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate signed/direct URL for PPT download
  const handleGenerateDownloadUrl = async (filePath: string, fileName?: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('sih-submissions')
        .createSignedUrl(filePath, 3600); // 1 hour signed URL

      if (data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = fileName || 'SIH_Presentation';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const { data: pubData } = supabase.storage
          .from('sih-submissions')
          .getPublicUrl(filePath);

        if (pubData?.publicUrl) {
          window.open(pubData.publicUrl, '_blank');
        } else {
          alert('Download error: ' + (error?.message || 'Storage file not found. Ensure supabase_schema.sql was run.'));
        }
      }
    } catch (err: any) {
      alert('Download error: ' + err.message);
    }
  };

  // Delete submission / reset team details so student can re-fill cleanly
  const handleDeleteTeamSubmission = async (teamRecord: AdminTeamRecord) => {
    if (!confirm(`Are you sure you want to delete/reset submission for "${teamRecord.team_name}"? This will unlock the student account to re-fill and re-submit clean details.`)) {
      return;
    }

    try {
      setSavingReview(true);
      if (teamRecord.submission?.id) {
        await supabase.from('submissions').delete().eq('id', teamRecord.submission.id);
      }
      await supabase.from('team_members').delete().eq('team_id', teamRecord.id);
      await supabase.from('teams').delete().eq('id', teamRecord.id);

      setMsg({ type: 'success', text: `Team "${teamRecord.team_name}" submission reset & deleted successfully! Student can now re-submit.` });
      fetchAdminDashboardData();
      setTimeout(() => {
        setSelectedTeam(null);
      }, 1500);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete submission.' });
    } finally {
      setSavingReview(false);
    }
  };

  // Export Full Team Summary Details as Printable PDF Document
  const handleExportTeamPDF = (teamRecord: AdminTeamRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SIH 2026 Team Summary Report - ${teamRecord.team_name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
          .header { border-bottom: 3px solid #0284c7; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { margin: 0; color: #0f172a; font-size: 22px; }
          .header p { margin: 5px 0 0 0; color: #64748b; font-size: 13px; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; background: #dcfce7; color: #166534; border: 1px solid #86efac; }
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
            <p>College SPOC Coordination Team Summary Report</p>
          </div>
          <div>
            <span class="badge">Status: ${teamRecord.submission_status}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Team & Problem Statement Information</div>
          <div class="grid">
            <div class="info-box">
              <div class="info-label">Team Name</div>
              <div class="info-value">${teamRecord.team_name}</div>
            </div>
            <div class="info-box">
              <div class="info-label">SIH Problem Statement ID</div>
              <div class="info-value">${teamRecord.problem_statement_id}</div>
            </div>
          </div>
          <div class="info-box" style="margin-top: 10px;">
            <div class="info-label">Problem Statement Title</div>
            <div class="info-value">${teamRecord.problem_statement_title}</div>
          </div>
          <div class="info-box" style="margin-top: 10px;">
            <div class="info-label">Proposed Solution Title & Description</div>
            <div class="info-value"><strong>${teamRecord.solution_title}</strong></div>
            <div style="font-size: 12px; margin-top: 4px; color: #475569;">${teamRecord.solution_description}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Registered Team Members (${(teamRecord.team_members || []).length} Members)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Member Name</th>
                <th>Roll Number</th>
                <th>Email ID</th>
                <th>Mobile</th>
                <th>Gender</th>
                <th>Branch, Year & Faculty</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              ${(teamRecord.team_members || []).map((m: any, i: number) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${m.name}</strong></td>
                  <td>${m.roll_number}</td>
                  <td>${m.email}</td>
                  <td>${m.mobile}</td>
                  <td>${m.gender}</td>
                  <td>${m.branch} (${m.year})<br/><small style="color:#64748b;">${m.faculty || 'Faculty of Engineering'}</small></td>
                  <td>${m.is_team_lead ? '<strong style="color: #d97706;">Team Lead</strong>' : 'Member'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Solution File & SPOC Remarks</div>
          <div class="info-box">
            <div class="info-label">Uploaded File Name</div>
            <div class="info-value">${teamRecord.submission?.file_name || 'No file uploaded'}</div>
          </div>
          <div class="info-box" style="margin-top: 10px;">
            <div class="info-label">SPOC Review Remarks</div>
            <div class="info-value">${teamRecord.submission?.admin_remarks || 'No SPOC remarks added.'}</div>
          </div>
        </div>

        <div class="footer">
          Generated automatically by SIH 2026 College Coordination Portal • Date: ${new Date().toLocaleString()}
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Export All Teams Master Data as Native Excel (.xlsx) File
  const handleExportMasterExcel = () => {
    if (!filteredTeams || filteredTeams.length === 0) {
      alert('No team records available to export.');
      return;
    }

    const excelRows = filteredTeams.map((team, index) => {
      const members = team.team_members || [];
      const maleCount = members.filter(m => (m.gender || '').toString().trim().toLowerCase() === 'male').length;
      const femaleCount = members.filter(m => (m.gender || '').toString().trim().toLowerCase() === 'female').length;

      const row: Record<string, any> = {
        'S.No': index + 1,
        'Team Name': team.team_name,
        'Problem Statement ID': team.problem_statement_id,
        'Problem Statement Title': team.problem_statement_title,
        'Solution Title': team.solution_title,
        'Solution Description': team.solution_description,
        'Total Members Count': members.length,
        'Total Boys / Males Count': maleCount,
        'Total Females Count': femaleCount,
        'Mandatory Female Check Status': (femaleCount >= 1 || team.has_female_member) ? 'Satisfied ✓' : 'Missing ✗',
        'Submission Status': team.submission_status,
      };

      // Add all 6 members in the same row with explicit fields
      for (let i = 0; i < 6; i++) {
        const m = members[i] || {};
        const prefix = `Member ${i + 1}${m.is_team_lead ? ' (Lead)' : ''}`;
        row[`${prefix} Name`] = m.name || '';
        row[`${prefix} Roll No`] = m.roll_number || '';
        row[`${prefix} Email`] = m.email || '';
        row[`${prefix} Mobile`] = m.mobile || '';
        row[`${prefix} Gender`] = m.gender || '';
        row[`${prefix} Branch`] = m.branch || '';
        row[`${prefix} Academic Year`] = m.year || '';
        row[`${prefix} Faculty Stream`] = m.faculty || 'Faculty of Engineering';
      }

      row['Uploaded File Name'] = team.submission?.file_name || 'No File Uploaded';
      row['SPOC Admin Remarks'] = team.submission?.admin_remarks || '';
      row['Submission Date'] = new Date(team.created_at).toLocaleString();

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Auto-fit Column Widths
    const colWidths = Object.keys(excelRows[0] || {}).map(key => ({
      wch: Math.max(key.length + 3, 16)
    }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SIH All Teams Master Data');

    // Trigger instant browser download
    XLSX.writeFile(workbook, `SIH_2026_All_Teams_Master_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleOpenReview = (team: AdminTeamRecord) => {
    setSelectedTeam(team);
    setReviewStatus(team.submission?.validation_status || team.submission_status || 'UNDER_REVIEW');
    setReviewRemarks(team.submission?.admin_remarks || '');
    setMsg(null);
  };

  const handleSaveReview = async () => {
    if (!selectedTeam || !selectedTeam.submission) {
      setMsg({ type: 'error', text: 'No uploaded solution file available for review.' });
      return;
    }

    setSavingReview(true);
    setMsg(null);

    try {
      // 1. Try RPC function execution
      const { error: rpcErr } = await supabase.rpc('review_submission', {
        p_submission_id: selectedTeam.submission.id,
        p_status: reviewStatus,
        p_remarks: reviewRemarks,
      });

      if (rpcErr) {
        // 2. Direct Supabase Query Fallback if RPC function is missing
        const { error: subErr } = await supabase
          .from('submissions')
          .update({
            validation_status: reviewStatus,
            admin_remarks: reviewRemarks,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', selectedTeam.submission.id);

        if (subErr) throw subErr;

        // Also update team submission_status
        await supabase
          .from('teams')
          .update({
            submission_status: reviewStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedTeam.id);
      }

      setMsg({ type: 'success', text: 'Review status and remarks updated live!' });
      fetchAdminDashboardData();
      setTimeout(() => {
        setSelectedTeam(null);
      }, 1200);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to save review.' });
    } finally {
      setSavingReview(false);
    }
  };

  // Analytics Metrics Calculations
  const totalTeams = teams.length;
  const pptsUploaded = teams.filter((t) => t.submission !== null).length;
  const pptsValid = teams.filter((t) => t.submission_status === 'VALID').length;
  const pptsInvalid = teams.filter((t) => t.submission_status === 'INVALID').length;
  const pptsNeedsCorrection = teams.filter((t) => t.submission_status === 'NEEDS_CORRECTION').length;
  const pendingSubmissions = totalTeams - pptsUploaded;

  // Search & Filter Logic
  const filteredTeams = teams
    .filter((t) => {
      const matchSearch =
        t.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.problem_statement_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.problem_statement_title.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'ALL' || t.submission_status === statusFilter;

      const matchFemale =
        femaleFilter === 'ALL' ||
        (femaleFilter === 'SATISFIED' && t.has_female_member) ||
        (femaleFilter === 'MISSING' && !t.has_female_member);

      return matchSearch && matchStatus && matchFemale;
    })
    .sort((a, b) => {
      if (sortBy === 'latest') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortBy === 'oldest') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return a.team_name.localeCompare(b.team_name);
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VALID':
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold text-[11px] flex items-center space-x-1"><CheckCircle2 className="w-3 h-3" /><span>Valid</span></span>;
      case 'NEEDS_CORRECTION':
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800 font-bold text-[11px] flex items-center space-x-1"><AlertTriangle className="w-3 h-3" /><span>Needs Correction</span></span>;
      case 'INVALID':
        return <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 font-bold text-[11px] flex items-center space-x-1"><AlertCircle className="w-3 h-3" /><span>Invalid</span></span>;
      case 'UNDER_REVIEW':
        return <span className="px-2.5 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 font-bold text-[11px] flex items-center space-x-1"><RefreshCw className="w-3 h-3 animate-spin" /><span>Under Review</span></span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px] font-medium">Pending</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Total Teams</span>
          <span className="text-2xl font-extrabold text-white">{totalTeams}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400 block mb-1">PPTs Uploaded</span>
          <span className="text-2xl font-extrabold text-cyan-400">{pptsUploaded}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Valid PPTs</span>
          <span className="text-2xl font-extrabold text-emerald-400">{pptsValid}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Needs Correction</span>
          <span className="text-2xl font-extrabold text-amber-400">{pptsNeedsCorrection}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Invalid Format</span>
          <span className="text-2xl font-extrabold text-rose-400">{pptsInvalid}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Pending</span>
          <span className="text-2xl font-extrabold text-slate-400">{pendingSubmissions}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Team, PS ID, Title..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3 w-full md:w-auto text-xs">
          <div className="flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="VALID">Valid / Approved</option>
              <option value="NEEDS_CORRECTION">Needs Correction</option>
              <option value="INVALID">Invalid Format</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="DRAFT">Submission Pending</option>
            </select>
          </div>

          <select
            value={femaleFilter}
            onChange={(e) => setFemaleFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
          >
            <option value="ALL">Female Req: All</option>
            <option value="SATISFIED">Satisfied ✓</option>
            <option value="MISSING">Missing ✗</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
          >
            <option value="latest">Sort: Latest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="name">Sort: Team Name</option>
          </select>
        </div>
      </div>

      {/* Main Admin Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span>SIH Registered Teams ({filteredTeams.length})</span>
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportMasterExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 transition-all border border-emerald-500/40 hover:scale-105"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Master Excel (.xlsx)</span>
            </button>
            <button
              onClick={fetchAdminDashboardData}
              className="p-2 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all text-xs flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading SPOC Dashboard records...</div>
        ) : filteredTeams.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No student team submissions match the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Team Name</th>
                  <th className="py-3.5 px-4">PS ID</th>
                  <th className="py-3.5 px-4">Problem Statement</th>
                  <th className="py-3.5 px-4">Members</th>
                  <th className="py-3.5 px-4">Female Check</th>
                  <th className="py-3.5 px-4">PPT Status</th>
                  <th className="py-3.5 px-4">Remarks</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTeams.map((team) => (
                  <tr key={team.id} className="hover:bg-slate-950/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">{team.team_name}</td>
                    <td className="py-3.5 px-4 font-mono text-cyan-400">{team.problem_statement_id}</td>
                    <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-300">{team.problem_statement_title}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[11px]">
                        {team.team_members?.length || 0}/6
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {team.has_female_member ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold text-[10px]">
                          Satisfied ✓
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-semibold text-[10px]">
                          Missing ✗
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(team.submission_status)}</td>
                    <td className="py-3.5 px-4 max-w-[150px] truncate text-slate-400">
                      {team.submission?.admin_remarks || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenReview(team)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold transition-all inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TEAM REVIEW & INSPECTION SLIDE-OVER DRAWER */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 max-w-2xl w-full h-full p-6 overflow-y-auto shadow-2xl space-y-6">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span>Reviewing Team: {selectedTeam.team_name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  PS ID: {selectedTeam.problem_statement_id} • {selectedTeam.problem_statement_title}
                </p>
              </div>
              <button
                onClick={() => setSelectedTeam(null)}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {msg && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 ${
                  msg.type === 'success'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                }`}
              >
                <span>{msg.text}</span>
              </div>
            )}

            {/* Solution Info */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <h4 className="font-bold text-amber-400 uppercase tracking-wider">Solution Proposal</h4>
              <p className="text-white font-semibold">{selectedTeam.solution_title}</p>
              <p className="text-slate-300">{selectedTeam.solution_description}</p>
            </div>

            {/* Team Members List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Registered Team Members (6)</span>
                <span className={selectedTeam.has_female_member ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  Female Req: {selectedTeam.has_female_member ? 'Satisfied ✓' : 'Missing ✗'}
                </span>
              </h4>
              <div className="bg-slate-950 rounded-2xl border border-slate-800 divide-y divide-slate-800/80 text-xs">
                {(selectedTeam.team_members || []).map((m: any, i: number) => (
                  <div key={i} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">{m.name}</span>
                      <span className="text-slate-500 text-[11px] ml-2">({m.roll_number}) • {m.branch} {m.year} {m.faculty ? `• ${m.faculty}` : ''}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.gender === 'Female' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-900 text-slate-400'}`}>
                        {m.gender}
                      </span>
                      {m.is_team_lead && <span className="text-[10px] font-bold text-amber-400">Team Lead</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Uploaded File Inspection & Download */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Automated Structure & Format Report</span>
                </h4>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleExportTeamPDF(selectedTeam)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center space-x-1 transition-all border border-slate-700"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Export Team PDF</span>
                  </button>
                  {selectedTeam.submission && (
                    <button
                      onClick={() => handleGenerateDownloadUrl(selectedTeam.submission.file_path, selectedTeam.submission.file_name)}
                      className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center space-x-1 transition-all shadow-md shadow-cyan-600/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Solution File</span>
                    </button>
                  )}
                </div>
              </div>

              {selectedTeam.submission ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-400 bg-slate-900 p-3 rounded-xl border border-slate-800 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Standardized File Name</span>
                      <span className="font-mono text-cyan-300 font-bold">{selectedTeam.submission.file_name}</span>
                    </div>
                    <div>
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${selectedTeam.submission.detected_slide_count > 6 ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'}`}>
                        Detected Slides: {selectedTeam.submission.detected_slide_count} / 6 Max
                      </span>
                    </div>
                  </div>

                  {selectedTeam.submission.validation_issues && (
                    <div className="space-y-3">
                      {selectedTeam.submission.validation_issues.issues?.length > 0 ? (
                        <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 space-y-1 text-[11px]">
                          <span className="font-bold text-rose-400 block">Format & Structural Issues Detected:</span>
                          <ul className="list-disc list-inside text-rose-200 space-y-0.5">
                            {selectedTeam.submission.validation_issues.issues.map((iss: string, i: number) => (
                              <li key={i}>{iss}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-[11px]">
                          ✓ No structural issues detected. Presentation complies with official 6-slide SIH template.
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <span className="font-bold text-emerald-400 block">Detected Section Headers:</span>
                          {selectedTeam.submission.validation_issues.detectedHeaders?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedTeam.submission.validation_issues.detectedHeaders.map((h: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                                  {h}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-500">None detected</p>
                          )}
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <span className="font-bold text-amber-400 block">Missing Mandatory Sections:</span>
                          {selectedTeam.submission.validation_issues.missingHeaders?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedTeam.submission.validation_issues.missingHeaders.map((h: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px]">
                                  {h}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-emerald-400 text-[10px]">All mandatory sections detected! ✓</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 italic">No solution file uploaded by student team yet.</p>
              )}
            </div>

            {/* Admin SPOC Review Action Form */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                <MessageSquare className="w-4 h-4" />
                <span>SPOC Validation & Remarks Control</span>
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Set Submission Status</label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="VALID">Valid / Approved</option>
                  <option value="NEEDS_CORRECTION">Needs Correction</option>
                  <option value="INVALID">Invalid Format</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">SPOC Admin Remarks</label>
                <textarea
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Enter remarks for student team (e.g. PPT has 8 slides. Please reduce to 6 max as per SIH template)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleSaveReview}
                  disabled={savingReview}
                  className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  {savingReview ? 'Saving Review...' : 'Save Review & Sync'}
                </button>
                <button
                  onClick={() => handleDeleteTeamSubmission(selectedTeam)}
                  disabled={savingReview}
                  className="py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs transition-all disabled:opacity-50"
                >
                  Delete & Reset Team
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
