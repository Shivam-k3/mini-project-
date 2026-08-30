import { useState } from 'react';
import { reportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import CopyButton from '../components/CopyButton';
import { FiDownload, FiFileText, FiEye, FiZap, FiBarChart2, FiCpu, FiTrendingUp, FiCalendar, FiCheckCircle } from 'react-icons/fi';

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const downloadPDF = async () => {
    setLoading(true);
    try {
      const { data } = await reportsAPI.downloadPDF();
      const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `ecoguardian-report-${Date.now()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF report downloaded successfully!');
    } catch {
      toast.error('Failed to generate PDF. Make sure you have logged carbon entries first.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-eco-700 dark:text-eco-400">Carbon Audits & Reports</p>
          <h1 className="text-3xl font-bold text-ink-900 dark:text-white">Audit and Compile Reports</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Audit carbon history, review AI summaries, and compile downloadable PDF reports.</p>
        </div>
        <button onClick={downloadPDF} disabled={loading} className="btn-primary flex items-center gap-1.5 select-none text-xs">
          <FiDownload size={14} /> {loading ? 'Compiling PDF...' : 'Download PDF Report'}
        </button>
      </div>

      {/* Main Layout: Preview (Left) vs Summary Information (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left: Document Page Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 dark:text-ink-500 flex items-center gap-1.5">
              <FiEye size={12} /> Document Page Preview
            </span>
            <CopyButton text="EcoGuardian Carbon Audit Report - Daily Avg: 10.7 kg | Weekly: 74.9 kg | Monthly: 321.3 kg" label="Copy Summary" />
          </div>

          <div className="card p-8 sm:p-12 space-y-8 text-left">
            {/* Header branding */}
            <div className="flex justify-between items-start border-b border-ink-100 dark:border-ink-800 pb-6">
              <div>
                <h2 className="text-xl font-bold text-ink-900 dark:text-white">EcoGuardian</h2>
                <p className="text-[10px] text-eco-600 dark:text-eco-400 font-bold uppercase tracking-wider mt-0.5">UN SDG 13: Climate Action Audit</p>
              </div>
              <div className="text-right text-[10px] text-ink-400 dark:text-ink-500 font-medium space-y-0.5">
                <p className="flex items-center gap-1 justify-end"><FiCalendar size={10} /> Date: {new Date().toLocaleDateString()}</p>
                <p className="flex items-center gap-1 justify-end"><FiCheckCircle size={10} /> Status: Verified</p>
              </div>
            </div>

            {/* User Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-ink-500 dark:text-ink-400 bg-ink-50 dark:bg-ink-800/40 p-4 rounded-lg border border-ink-200 dark:border-ink-800">
              <div>
                <p className="text-[9px] text-ink-400 dark:text-ink-500 uppercase font-bold">Auditee Profile</p>
                <p className="text-ink-900 dark:text-white mt-1">{user?.name || 'Guardian Member'}</p>
                <p className="text-ink-400 dark:text-ink-500 text-[10px] font-mono mt-0.5">{user?.email}</p>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-[9px] text-ink-400 dark:text-ink-500 uppercase font-bold">Decarbonization Index</p>
                <p className="text-eco-600 dark:text-eco-400 font-bold mt-1">Eco Score: {user?.gamification?.ecoScore || 50}/100</p>
                <p className="text-ink-400 dark:text-ink-500 text-[10px] mt-0.5">{user?.gamification?.greenPoints || 0} Points Balance</p>
              </div>
            </div>

            {/* Audit Summary Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-ink-500 uppercase tracking-wider border-l-2 border-eco-600 pl-2">Emissions Summary</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-ink-50 dark:bg-ink-800/40 rounded-lg">
                  <p className="text-[9px] text-ink-400 dark:text-ink-500 font-bold uppercase">Daily Avg</p>
                  <p className="text-sm font-black text-ink-900 dark:text-white mt-0.5">10.7 kg</p>
                </div>
                <div className="p-3 bg-ink-50 dark:bg-ink-800/40 rounded-lg">
                  <p className="text-[9px] text-ink-400 dark:text-ink-500 font-bold uppercase">Weekly Total</p>
                  <p className="text-sm font-black text-ink-900 dark:text-white mt-0.5">74.9 kg</p>
                </div>
                <div className="p-3 bg-ink-50 dark:bg-ink-800/40 rounded-lg">
                  <p className="text-[9px] text-ink-400 dark:text-ink-500 font-bold uppercase">Monthly Total</p>
                  <p className="text-sm font-black text-ink-900 dark:text-white mt-0.5">321.3 kg</p>
                </div>
              </div>
            </div>

            {/* AI Recommendations section preview */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-ink-500 uppercase tracking-wider border-l-2 border-eco-600 pl-2">AI Optimization Recommendations</h4>
              <div className="space-y-2 text-xs text-ink-500 dark:text-ink-400 leading-relaxed font-medium">
                <p>1. <strong className="font-bold text-ink-900 dark:text-white">Mode Shift</strong>: Moving short car trips to metro cuts roughly 0.17 kg CO₂ per km travelled.</p>
                <p>2. <strong className="font-bold text-ink-900 dark:text-white">Alternative Commute</strong>: Transitioning short drives to bus/metro offsets emissions by 50%.</p>
                <p>3. <strong className="font-bold text-ink-900 dark:text-white">Carpool Occupancy</strong>: Sharing a car with 3 others splits the same trip's emissions four ways.</p>
              </div>
            </div>

            {/* Footer branding */}
            <div className="border-t border-ink-100 dark:border-ink-800 pt-6 text-center text-[9px] font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider">
              EcoGuardian — Certified SDG 13 Personal Carbon Audit Report
            </div>
          </div>
        </div>

        {/* Right: Report Modules (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 dark:text-ink-500 px-1 block">
            Report Modules Include
          </span>
          <div className="card p-5 space-y-4">
            {[
              { title: 'Travel Mode Breakdown', desc: 'Daily, weekly, and monthly footprint summaries categorized by travel mode, trip purpose, and vehicle occupancy.', icon: <FiBarChart2 size={16} /> },
              { title: 'Fine-Tuned AI Recommendations', desc: 'Personalized Decarbonization plans and action paths computed by LLM models using your logging history.', icon: <FiCpu size={16} /> },
              { title: 'Yearly Trend Forecasts', desc: 'Visual models predicting next week and next month carbon budgets using gradient boosting algorithms.', icon: <FiTrendingUp size={16} /> }
            ].map((item) => (
              <div key={item.title} className="flex gap-4 items-start pb-4 border-b border-ink-100 dark:border-ink-800 last:border-0 last:pb-0">
                <span className="w-9 h-9 rounded-lg bg-ink-100 dark:bg-ink-800 text-eco-600 dark:text-eco-400 flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-ink-900 dark:text-white leading-none">{item.title}</h4>
                  <p className="text-[10px] text-ink-400 dark:text-ink-500 mt-1 leading-normal">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-4 flex items-start gap-2">
            <FiZap className="text-eco-600 dark:text-eco-400 shrink-0 mt-0.5" size={13} />
            <span className="text-[10px] text-ink-500 dark:text-ink-400 leading-normal">Clicking "Download PDF" calls the backend to generate a publication-quality PDF report directly from the server.</span>
          </div>
        </div>

      </div>

    </div>
  );
}