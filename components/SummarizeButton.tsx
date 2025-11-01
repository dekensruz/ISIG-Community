import React, { useState } from 'react';
import { summarizeText } from '../services/gemini';
import { Wand2 } from 'lucide-react';
import Spinner from './Spinner';

interface SummarizeButtonProps {
  textToSummarize: string;
}

const SummarizeButton: React.FC<SummarizeButtonProps> = ({ textToSummarize }) => {
  const [showModal, setShowModal] = useState(false);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

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
  }

  return (
    <>
      <button 
        onClick={handleSummarize}
        className="flex items-center space-x-1 hover:text-isig-blue"
        title="Résumer avec l'IA"
      >
        <Wand2 size={20} />
        <span>Résumer</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-isig-blue">Résumé par l'IA</h2>
              <button onClick={handleClose} className="text-gray-500 hover:text-gray-800">&times;</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <Spinner />
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">{summary}</p>
              )}
            </div>
            <div className="text-right mt-4">
               <button 
                 onClick={handleClose} 
                 className="bg-isig-orange text-white px-4 py-2 rounded-lg hover:bg-orange-600"
                >
                 Fermer
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SummarizeButton;