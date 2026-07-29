import { useState } from 'react';
import { reportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiDownload, FiFileText, FiEye, FiZap } from 'react-icons/fi';

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
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Carbon Audits & Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Audit carbon history, review AI summaries, and compile downloadable PDF reports.</p>
        </div>
        <button onClick={downloadPDF} disabled={loading} className="btn-primary flex items-center gap-1.5 select-none text-xs">
          <FiDownload size={14} /> {loading ? 'Compiling PDF...' : 'Download PDF Report'}
        </button>
      </div>

      {/* Main Layout: Preview (Left) vs Summary Information (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Notion-inspired Paper Document Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 flex items-center gap-1">
            <FiEye /> Document Page Preview
          </span>
          
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 rounded-3xl shadow-xl p-8 sm:p-12 text-left space-y-8 relative overflow-hidden transition-all duration-300">
            {/* Header branding */}
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800/80 pb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">EcoGuardian AI</h2>
                <p className="text-[10px] text-eco-500 font-bold uppercase tracking-wider mt-0.5">UN SDG 13: Climate Action Audit</p>
              </div>
              <div className="text-right text-[10px] text-gray-400 font-medium">
                <p>Date: {new Date().toLocaleDateString()}</p>
                <p>Status: Verified</p>
              </div>
            </div>

            {/* User Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-150 dark:border-white/5">
              <div>
                <p className="text-[9px] text-gray-400 uppercase font-bold">Auditee Profile</p>
                <p className="text-gray-800 dark:text-white mt-1">{user?.name || 'Guardian Member'}</p>
                <p className="text-gray-400 text-[10px] font-mono mt-0.5">{user?.email}</p>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-[9px] text-gray-400 uppercase font-bold">Decarbonization Index</p>
                <p className="text-eco-500 font-bold mt-1">Eco Score: {user?.gamification?.ecoScore || 50}/100</p>
                <p className="text-gray-400 text-[10px] mt-0.5">{user?.gamification?.greenPoints || 0} Points Balance</p>
              </div>
            </div>

            {/* Audit Summary Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-l-2 border-eco-500 pl-2">Emissions Summary</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl">
                  <p className="text-[9px] text-gray-400 font-bold uppercase">Daily Avg</p>
                  <p className="text-sm font-black text-gray-800 dark:text-white mt-0.5">10.7 kg</p>
                </div>
                <div className="p-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl">
                  <p className="text-[9px] text-gray-400 font-bold uppercase">Weekly Total</p>
                  <p className="text-sm font-black text-gray-800 dark:text-white mt-0.5">74.9 kg</p>
                </div>
                <div className="p-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl">
                  <p className="text-[9px] text-gray-400 font-bold uppercase">Monthly Total</p>
                  <p className="text-sm font-black text-gray-800 dark:text-white mt-0.5">321.3 kg</p>
                </div>
              </div>
            </div>

            {/* AI Recommendations section preview */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-l-2 border-eco-500 pl-2">AI Optimization Recommendations</h4>
              <div className="space-y-2 text-xs text-gray-500 leading-relaxed font-medium">
                <p>1. **Grid Electricity Cuts**: Reduce standby power by 20% to save approximately 0.95 kg CO₂ daily.</p>
                <p>2. **Alternative Commute**: Transitioning short drives to bus/metro offsets emissions by 50%.</p>
                <p>3. **Nutritional Offsets**: A vegetable diet reduces food footprint variables significantly.</p>
              </div>
            </div>

            {/* Footer branding */}
            <div className="border-t border-gray-100 dark:border-gray-800/80 pt-6 text-center text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
              EcoGuardian AI — Certified SDG 13 Personal Carbon Audit Report
            </div>
          </div>
        </div>

        {/* Right: Informational features (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 block">
            Report Modules Include
          </span>
          <div className="glass-card p-5 space-y-4">
            {[
              { title: 'Utility Audit Breakdown', desc: 'Daily, weekly, and monthly footprint summaries categorized by transport, utility grid, nutrition, and waste variables.', icon: '📊' },
              { title: 'Fine-Tuned AI Recommendations', desc: 'Personalized Decarbonization plans and action paths computed by LLM models using your logging history.', icon: '🤖' },
              { title: 'Yearly Trend Forecasts', desc: 'Visual models predicting next week and next month carbon budgets using gradient boosting algorithms.', icon: '📈' }
            ].map((item) => (
              <div key={item.title} className="flex gap-4 items-start pb-4 border-b border-gray-100 dark:border-gray-850 last:border-0 last:pb-0">
                <span className="text-2xl select-none">{item.icon}</span>
                <div>
                  <h4 className="font-bold text-xs text-gray-800 dark:text-white leading-none">{item.title}</h4>
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 rounded-2xl bg-gradient-to-br from-eco-500/5 to-ocean-500/5 border border-eco-500/10 text-[10px] text-gray-400 leading-normal flex items-start gap-2">
            <FiZap className="text-eco-500 shrink-0 mt-0.5" size={13} />
            <span>Clicking "Download PDF" calls the backend to generate a publication-quality PDF report directly from the server.</span>
          </div>
        </div>

      </div>

    </div>
  );
}
