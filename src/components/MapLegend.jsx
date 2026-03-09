import React from 'react';
import Icon from './Icon';

const MapLegend = ({ sortedLegend, censusSectors }) => (
    <div className="absolute bottom-5 right-5 z-[500] bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-xl border border-gray-200 w-40 animate-in fade-in zoom-in duration-300">
        <div className="text-xs font-bold text-gray-700 mb-2 border-b pb-1">Legenda</div>
        <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-gray-700">
                <div className="w-3 h-3 rounded border border-emerald-700 bg-emerald-500"></div>
                <span>{sortedLegend[0]} min</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-700">
                <div className="w-3 h-3 rounded border border-yellow-600 bg-yellow-400"></div>
                <span>{sortedLegend[1]} min</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-700">
                <div className="w-3 h-3 rounded border border-red-800 bg-red-500"></div>
                <span>{sortedLegend[2]} min</span>
            </div>
            {censusSectors && censusSectors.features?.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-700">
                    <div className="w-3 h-3 rounded border border-blue-600 bg-blue-400 opacity-60"></div>
                    <span>Setores IBGE</span>
                </div>
            )}
        </div>
    </div>
);

export default MapLegend;
