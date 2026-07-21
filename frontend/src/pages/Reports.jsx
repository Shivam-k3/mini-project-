import { useState } from 'react';
import { reportsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiDownload, FiFileText } from 'react-icons/fi';

export default function Reports() {
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
      toast.success('Report downloaded!');
    } catch {
      toast.error('Failed to generate report. Log some entries first.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Reports</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Generate and download your carbon footprint reports</p>
      </div>

      <div className="glass-card max-w-lg mx-auto text-center py-12">
        <FiFileText size={64} className="mx-auto text-eco-500 mb-6" />
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Carbon Footprint Report</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
          Download a comprehensive PDF report including your carbon footprint summary,
          AI recommendations, progress graphs, and monthly comparison.
        </p>
        <button onClick={downloadPDF} disabled={loading} className="btn-primary inline-flex items-center gap-2">
          <FiDownload size={20} />
          {loading ? 'Generating...' : 'Download PDF Report'}
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { title: 'Emission Summary', desc: 'Daily, weekly, monthly totals with category breakdown', icon: '📊' },
          { title: 'AI Recommendations', desc: 'Personalized suggestions to reduce your carbon footprint', icon: '🤖' },
          { title: 'Progress Tracking', desc: 'Historical trends and month-over-month comparison', icon: '📈' },
        ].map((item) => (
          <div key={item.title} className="glass-card text-center">
            <p className="text-3xl mb-3">{item.icon}</p>
            <h4 className="font-semibold text-gray-800 dark:text-white">{item.title}</h4>
            <p className="text-sm text-gray-500 mt-2">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
