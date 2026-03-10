import React from 'react';

const MapLegend = ({ sortedLegend, censusSectors }) => (
    <div className="absolute bottom-20 md:bottom-5 right-3 md:right-5 z-[500] glass p-3 rounded-xl shadow-xl border border-white/30 w-36 animate-fade-in-up">
        <div className="text-[10px] font-bold text-slate-700 mb-2 pb-1.5 border-b border-slate-200/50 uppercase tracking-widest">Legenda</div>
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-700">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                <span className="font-medium">{sortedLegend[0]} min</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-sm shadow-yellow-200"></div>
                <span className="font-medium">{sortedLegend[1]} min</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-200"></div>
                <span className="font-medium">{sortedLegend[2]} min</span>
            </div>
            {censusSectors && censusSectors.features?.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-700 pt-1 border-t border-slate-200/30">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400 opacity-70 shadow-sm shadow-blue-200"></div>
                    <span className="font-medium">Setores IBGE</span>
                </div>
            )}
        </div>
    </div>
);

export default MapLegend;
