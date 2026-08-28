import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend 
} from 'recharts';
import { BarChart3, PieChart as PieIcon, TrendingUp, Users, Award, ShieldCheck } from 'lucide-react';

const COLORS = ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const AdminAnalytics: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const { data: tData } = await supabase.from('teams').select('*');
      const { data: mData } = await supabase.from('team_members').select('*');
      const { data: sData } = await supabase.from('submissions').select('*');

      setTeams(tData || []);
      setMembers(mData || []);
      setSubmissions(sData || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setTeams([]);
      setMembers([]);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  // 1. Teams per Problem Statement
  const psMap: Record<string, number> = {};
  teams.forEach((t) => {
    const id = t.problem_statement_id || 'Unassigned';
    psMap[id] = (psMap[id] || 0) + 1;
  });

  const psChartData = Object.keys(psMap).map((key) => ({
    psId: key,
    teamsCount: psMap[key],
  }));

  // 2. Submission Status Distribution
  const statusMap: Record<string, number> = {
    'VALID': 0,
    'NEEDS_CORRECTION': 0,
    'INVALID': 0,
    'UNDER_REVIEW': 0,
    'DRAFT': 0,
  };

  teams.forEach((t) => {
    const st = t.submission_status || 'DRAFT';
    statusMap[st] = (statusMap[st] || 0) + 1;
  });

  const statusChartData = [
    { name: 'Valid / Approved', value: statusMap['VALID'] },
    { name: 'Needs Correction', value: statusMap['NEEDS_CORRECTION'] },
    { name: 'Invalid Format', value: statusMap['INVALID'] },
    { name: 'Under Review', value: statusMap['UNDER_REVIEW'] },
    { name: 'Submission Pending', value: statusMap['DRAFT'] },
  ].filter(d => d.value > 0);

  // 3. Gender Distribution across all registered team members
  const genderMap: Record<string, number> = { Male: 0, Female: 0, Other: 0 };
  members.forEach((m) => {
    const g = m.gender || 'Male';
    genderMap[g] = (genderMap[g] || 0) + 1;
  });

  const genderChartData = [
    { name: 'Male Members', value: genderMap['Male'] },
    { name: 'Female Members (Mandatory Rule)', value: genderMap['Female'] },
    { name: 'Other', value: genderMap['Other'] },
  ].filter(d => d.value > 0);

  // 4. Submission Timeline Trend
  const timelineMap: Record<string, number> = {};
  submissions.forEach((s) => {
    const dateStr = new Date(s.uploaded_at).toLocaleDateString();
    timelineMap[dateStr] = (timelineMap[dateStr] || 0) + 1;
  });

  const timelineChartData = Object.keys(timelineMap).map((d) => ({
    date: d,
    uploads: timelineMap[d],
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Analytics Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center space-x-3 text-amber-400 mb-2">
          <BarChart3 className="w-6 h-6" />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Real-time SIH SPOC Analytics Dashboard
          </h1>
        </div>
        <p className="text-xs text-slate-400">
          Calculated dynamically from persistent database records.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Computing analytics graphs from database...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart 1: Teams per Problem Statement */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>Teams Distribution by Problem Statement</span>
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={psChartData.length > 0 ? psChartData : [{ psId: 'No Data', teamsCount: 0 }]}>
                  <XAxis dataKey="psId" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                  <Bar dataKey="teamsCount" fill="#0284c7" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Submission Status Distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              <span>Submission & PPT Validation Status</span>
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData.length > 0 ? statusChartData : [{ name: 'No Submissions', value: 1 }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Gender Distribution (Mandatory Female Member Tracking) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Gender Distribution across Team Members</span>
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderChartData.length > 0 ? genderChartData : [{ name: 'No Members', value: 1 }]}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                  >
                    {genderChartData.map((_, index) => (
                      <Cell key={`cell-g-${index}`} fill={index === 1 ? '#10b981' : '#0284c7'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Daily Submission Upload Timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>Daily Submission Upload Timeline</span>
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData.length > 0 ? timelineChartData : [{ date: 'Today', uploads: 0 }]}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="uploads" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
