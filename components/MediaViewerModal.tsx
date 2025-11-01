import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface MediaViewerModalProps {
  mediaUrl: string;
  mediaType: string;
  fileName: string;
  onClose: () => void;
}

const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ mediaUrl, mediaType, fileName, onClose }) => {

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  const handleDownload = async () => {
     try {
        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    } catch (error) {
        console.error("Erreur de téléchargement:", error);
        alert("Le téléchargement a échoué.");
    }
  };

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-black/80 z-[100] flex flex-col justify-center items-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="absolute top-0 right-0 p-4 flex items-center space-x-4 z-[110]">
          <button
              onClick={handleDownload}
              className="text-white hover:text-gray-300 p-2 bg-black/30 rounded-full transition-colors"
              aria-label="Télécharger le média"
          >
              <Download size={24} />
          </button>
          <button
              className="text-white hover:text-gray-300 p-2 bg-black/30 rounded-full transition-colors"
              onClick={onClose}
              aria-label="Fermer la vue"
          >
              <X size={24} />
          </button>
      </div>

      <div
        className="relative w-full h-full flex items-center justify-center p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaType.startsWith('image/') ? (
          <img
            src={mediaUrl}
            alt="Vue plein écran"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-white text-center bg-gray-800 p-8 rounded-lg">
             <h2 className="text-2xl font-bold mb-4">Aperçu non disponible</h2>
             <p className="mb-6">Ceci est un fichier de type: {mediaType}</p>
             <button onClick={handleDownload} className="bg-isig-blue text-white font-semibold py-3 px-6 rounded-lg flex items-center mx-auto space-x-2 hover:bg-blue-700">
                <Download size={20} />
                <span>Télécharger {fileName}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaViewerModal;
