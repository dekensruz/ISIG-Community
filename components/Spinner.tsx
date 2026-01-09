
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="relative flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-slate-100"></div>
        <div className="absolute h-10 w-10 rounded-full border-4 border-isig-blue border-t-transparent animate-spin"></div>
    </div>
  );
};

export default Spinner;
