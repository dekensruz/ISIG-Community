
import React from 'react';
import { TrendingUp, Users, Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Sidebar: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Section Trending */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-soft">
        <div className="flex items-center space-x-2 mb-4">
          <TrendingUp className="text-isig-blue" size={20} />
          <h3 className="font-extrabold text-slate-800 uppercase tracking-wider text-xs">Sujets populaires</h3>
        </div>
        <div className="space-y-3">
          {[
            { tag: '#GenieLogiciel', count: '124 publications' },
            { tag: '#ISIG_Innovation', count: '89 publications' },
            { tag: '#Exams2024', count: '56 publications' },
          ].map(item => (
            <div key={item.tag} className="group cursor-pointer">
              <p className="text-sm font-bold text-slate-700 group-hover:text-isig-blue transition-colors">{item.tag}</p>
              <p className="text-[10px] text-slate-400 font-medium">{item.count}</p>
            </div>
          ))}
        </div>
        <button className="w-full mt-4 py-2 text-xs font-bold text-isig-blue hover:bg-isig-blue/5 rounded-lg transition-colors">
          Voir plus
        </button>
      </div>

      {/* Section Suggestions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-soft">
         <div className="flex items-center space-x-2 mb-4">
          <Users className="text-isig-orange" size={20} />
          <h3 className="font-extrabold text-slate-800 uppercase tracking-wider text-xs">Groupes suggérés</h3>
        </div>
        <div className="space-y-4">
           {[
            { name: 'Club de Code', members: '42 membres' },
            { name: 'Entrepreneuriat L2', members: '18 membres' },
           ].map(group => (
             <div key={group.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400">#</div>
                    <div>
                        <p className="text-sm font-bold text-slate-700 truncate w-32">{group.name}</p>
                        <p className="text-[10px] text-slate-400">{group.members}</p>
                    </div>
                </div>
                <button className="p-1.5 bg-isig-blue/10 text-isig-blue rounded-lg hover:bg-isig-blue text-xs font-bold hover:text-white transition-all">
                    Rejoindre
                </button>
             </div>
           ))}
        </div>
      </div>

      {/* Événements à venir */}
      <div className="bg-gradient-to-br from-brand-dark to-slate-800 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-isig-orange/20 blur-2xl"></div>
        <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
                <Calendar size={18} className="text-isig-orange" />
                <h3 className="font-bold text-sm">Prochain événement</h3>
            </div>
            <p className="text-xs font-medium text-slate-300">Hackathon ISIG 2024</p>
            <p className="text-[10px] text-isig-orange font-bold mt-1">Dans 12 jours • Campus Goma</p>
            <Link to="/groups" className="mt-4 flex items-center text-[10px] font-extrabold text-white hover:underline">
                En savoir plus <ArrowRight size={12} className="ml-1" />
            </Link>
        </div>
      </div>

      {/* Footer minimal */}
      <div className="px-5 text-[10px] text-slate-400 font-medium">
        <p>© 2024 ISIG Community • Développé par le lab Innovation</p>
        <div className="flex space-x-3 mt-1">
            <button className="hover:text-slate-600 transition-colors">Confidentialité</button>
            <button className="hover:text-slate-600 transition-colors">Conditions</button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
