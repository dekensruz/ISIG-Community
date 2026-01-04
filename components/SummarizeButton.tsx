
import React, { useState } from 'react';
import { summarizeText } from '../services/gemini';
import { Wand2, X, Sparkles, Copy, Check } from 'lucide-react';
import Spinner from './Spinner';

interface SummarizeButtonProps {
  textToSummarize: string;
}

const SummarizeButton: React.FC<SummarizeButtonProps> = ({ textToSummarize }) => {
  const [showModal, setShowModal] = useState(false);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSummarize = async () => {
    setShowModal(true);
    setLoading(true);
    const result = await summarizeText(textToSummarize);
    setSummary(result);
    setLoading(false);
  };
  
  const handleClose = () => {
    setShowModal(false);
    setSummary('');
    setCopied(false);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button 
        onClick={handleSummarize}
        className="flex items-center space-x-2 px-4 py-2 text-isig-blue font-bold text-xs uppercase tracking-widest hover:bg-isig-blue/5 rounded-xl transition-all"
        title="Résumer avec l'IA"
      >
        <Wand2 size={16} />
        <span>Synthèse IA</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[100] flex justify-center items-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-3 text-isig-blue">
                        <Sparkles size={24} />
                        <h2 className="text-xl font-black tracking-tight">Résumé Intelligent</h2>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="min-h-[150px] max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50 rounded-3xl p-6 border border-slate-100">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-40 text-center">
                        <Spinner />
                        <p className="mt-4 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">L'IA analyse le contenu...</p>
                    </div>
                ) : (
                    <div className="prose prose-slate prose-sm max-w-none">
                        <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{summary}</p>
                    </div>
                )}
                </div>

                {!loading && summary && (
                    <div className="mt-6 flex items-center justify-between">
                        <button 
                            onClick={handleCopy}
                            className="flex items-center space-x-2 text-slate-400 hover:text-isig-blue transition-colors font-bold text-xs uppercase tracking-widest"
                        >
                            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                            <span>{copied ? 'Copié !' : 'Copier'}</span>
                        </button>
                        <button 
                            onClick={handleClose} 
                            className="bg-isig-blue text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-isig-blue/20 hover:bg-blue-600 transition-all active:scale-95"
                        >
                            Fermer
                        </button>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SummarizeButton;
