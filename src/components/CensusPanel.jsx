import React from 'react';
import Icon from './Icon';

const CensusPanel = ({
    loadingCensus,
    censusSectors,
    isCensusExpanded,
    setIsCensusExpanded,
    activeSectorId,
    highlightSector,
    onDownload,
}) => {
    if (!loadingCensus && !censusSectors) return null;

    return (
        <div className="glass-panel border border-blue-200/50 rounded-xl text-xs overflow-hidden animate-fade-in-up">
            <div
                className="p-3 flex justify-between items-center cursor-pointer hover:bg-blue-50/50 transition-colors"
                onClick={() => setIsCensusExpanded(!isCensusExpanded)}
            >
                <h3 className="font-bold text-blue-800 flex items-center gap-2 m-0 border-0">
                    <Icon name="layers" size={14} className="text-blue-600" />
                    Setores Censitários
                    {censusSectors && (
                        <span className="bg-blue-200/60 text-blue-800 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
                            {censusSectors.summary?.total_setores || 0}
                        </span>
                    )}
                </h3>
                <div className="flex items-center gap-1">
                    {censusSectors && censusSectors.features?.length > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDownload(); }}
                            className="text-blue-400 hover:text-blue-700 p-1 rounded-lg hover:bg-blue-100/50 transition-colors"
                            title="Baixar lista CSV"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        </button>
                    )}
                    <button className="text-blue-400 hover:text-blue-700 transition-colors">
                        <Icon name={isCensusExpanded ? 'chevronUp' : 'chevronDown'} size={16} />
                    </button>
                </div>
            </div>

            {isCensusExpanded && (
                <div className="border-t border-blue-100/50">
                    {loadingCensus ? (
                        <div className="text-blue-400 flex flex-col items-center py-4">
                            <div className="spinner !border-blue-200 !border-t-blue-600 mb-2"></div>
                            <span className="text-xs">Buscando setores censitários...</span>
                        </div>
                    ) : censusSectors && censusSectors.features?.length > 0 ? (
                        <div>
                            {/* Resumo */}
                            <div className="p-3 grid grid-cols-3 gap-2">
                                <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2 text-center border border-blue-100/50">
                                    <div className="text-blue-600 font-bold text-sm">{censusSectors.summary?.total_setores?.toLocaleString('pt-BR')}</div>
                                    <div className="text-slate-500 text-[9px] font-medium">Setores</div>
                                </div>
                                <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2 text-center border border-blue-100/50">
                                    <div className="text-blue-600 font-bold text-sm">{censusSectors.summary?.total_populacao?.toLocaleString('pt-BR')}</div>
                                    <div className="text-slate-500 text-[9px] font-medium">População</div>
                                </div>
                                <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2 text-center border border-blue-100/50">
                                    <div className="text-blue-600 font-bold text-sm">{censusSectors.summary?.total_domicilios?.toLocaleString('pt-BR')}</div>
                                    <div className="text-slate-500 text-[9px] font-medium">Domicílios</div>
                                </div>
                            </div>

                            {/* Lista de setores */}
                            <div className="max-h-[30vh] overflow-y-auto custom-scroll">
                                {censusSectors.features.map((f, i) => (
                                    <div
                                        key={i}
                                        className={`census-sector-item px-3 py-1.5 border-t border-blue-50/50 cursor-pointer flex justify-between items-center ${activeSectorId === f.properties.CD_SETOR ? 'active' : ''}`}
                                        onClick={() => highlightSector(f.properties.CD_SETOR)}
                                    >
                                        <div>
                                            <div className="font-mono text-[10px] text-blue-700 font-bold">{f.properties.CD_SETOR}</div>
                                            <div className="text-slate-500 text-[9px]">
                                                {f.properties.NM_BAIRRO && f.properties.NM_BAIRRO !== '.' ? f.properties.NM_BAIRRO : f.properties.SITUACAO}
                                                {f.properties.CD_TIPO !== '0' && ` • Tipo ${f.properties.CD_TIPO}`}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-700 font-semibold">{(f.properties.v0001 || 0).toLocaleString('pt-BR')} hab</div>
                                            <div className="text-[9px] text-slate-400">{(f.properties.v0002 || 0).toLocaleString('pt-BR')} dom • {f.properties.pct_cobertura}%</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : censusSectors ? (
                        <div className="p-3 text-slate-500 text-center">Nenhum setor encontrado nesta isócrona.</div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default CensusPanel;
