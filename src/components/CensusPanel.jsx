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
    malhaType = 'setores',
}) => {
    if (!loadingCensus && !censusSectors) return null;

    const isBairros = malhaType === 'bairros';
    const isSubdistritos = malhaType === 'subdistritos';
    const idKey = isSubdistritos ? 'CD_SUBDIST' : isBairros ? 'CD_BAIRRO' : 'CD_SETOR';
    const title = isSubdistritos ? 'Subdistritos' : isBairros ? 'Bairros' : 'Setores Censitários';
    const countKey = isSubdistritos ? 'total_subdistritos' : isBairros ? 'total_bairros' : 'total_setores';
    const accentColor = isSubdistritos ? 'violet' : isBairros ? 'teal' : 'blue';
    const usesAggData = isBairros || isSubdistritos;

    return (
        <div className={`glass-panel border border-${accentColor}-200/50 rounded-xl text-xs overflow-hidden animate-fade-in-up`}>
            <div
                className={`p-3 flex justify-between items-center cursor-pointer hover:bg-${accentColor}-50/50 transition-colors`}
                onClick={() => setIsCensusExpanded(!isCensusExpanded)}
            >
                <h3 className={`font-bold text-${accentColor}-800 flex items-center gap-2 m-0 border-0`}>
                    <Icon name="layers" size={14} className={`text-${accentColor}-600`} />
                    {title}
                    {censusSectors && (
                        <span className={`bg-${accentColor}-200/60 text-${accentColor}-800 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold`}>
                            {censusSectors.summary?.[countKey] || 0}
                        </span>
                    )}
                </h3>
                <div className="flex items-center gap-1">
                    {censusSectors && censusSectors.features?.length > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDownload(); }}
                            className={`text-${accentColor}-400 hover:text-${accentColor}-700 p-1 rounded-lg hover:bg-${accentColor}-100/50 transition-colors`}
                            title="Baixar CSV"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        </button>
                    )}
                    <button className={`text-${accentColor}-400 hover:text-${accentColor}-700 transition-colors`}>
                        <Icon name={isCensusExpanded ? 'chevronUp' : 'chevronDown'} size={16} />
                    </button>
                </div>
            </div>

            {isCensusExpanded && (
                <div className={`border-t border-${accentColor}-100/50`}>
                    {loadingCensus ? (
                        <div className={`text-${accentColor}-400 flex flex-col items-center py-4`}>
                            <div className={`spinner !border-${accentColor}-200 !border-t-${accentColor}-600 mb-2`}></div>
                            <span className="text-xs">Buscando {isSubdistritos ? 'subdistritos' : isBairros ? 'bairros' : 'setores'}...</span>
                        </div>
                    ) : censusSectors && censusSectors.features?.length > 0 ? (
                        <div>
                            {/* Resumo */}
                            <div className="p-3 grid grid-cols-3 gap-2">
                                <div className={`bg-white/70 backdrop-blur-sm rounded-lg p-2 text-center border border-${accentColor}-100/50`}>
                                    <div className={`text-${accentColor}-600 font-bold text-sm`}>{censusSectors.summary?.[countKey]?.toLocaleString('pt-BR')}</div>
                                    <div className="text-slate-500 text-[9px] font-medium">{isSubdistritos ? 'Subdist.' : isBairros ? 'Bairros' : 'Setores'}</div>
                                </div>
                                <div className={`bg-white/70 backdrop-blur-sm rounded-lg p-2 text-center border border-${accentColor}-100/50`}>
                                    <div className={`text-${accentColor}-600 font-bold text-sm`}>{censusSectors.summary?.total_populacao?.toLocaleString('pt-BR')}</div>
                                    <div className="text-slate-500 text-[9px] font-medium">População</div>
                                </div>
                                <div className={`bg-white/70 backdrop-blur-sm rounded-lg p-2 text-center border border-${accentColor}-100/50`}>
                                    <div className={`text-${accentColor}-600 font-bold text-sm`}>{censusSectors.summary?.total_domicilios?.toLocaleString('pt-BR')}</div>
                                    <div className="text-slate-500 text-[9px] font-medium">Domicílios</div>
                                </div>
                            </div>

                            {/* Lista */}
                            <div className="max-h-[30vh] overflow-y-auto custom-scroll">
                                {censusSectors.features.map((f, i) => {
                                    const p = f.properties;
                                    const isActive = activeSectorId === p[idKey];

                                    return (
                                        <div
                                            key={i}
                                            className={`census-sector-item px-3 py-1.5 border-t border-${accentColor}-50/50 cursor-pointer flex justify-between items-center ${isActive ? 'active' : ''}`}
                                            onClick={() => highlightSector(p[idKey])}
                                        >
                                            <div>
                                                {isSubdistritos ? (
                                                    <>
                                                        <div className="font-semibold text-[11px] text-violet-800">{p.NM_SUBDIST || 'Sem nome'}</div>
                                                        <div className="text-slate-500 text-[9px] font-mono">{p.CD_SUBDIST}</div>
                                                    </>
                                                ) : isBairros ? (
                                                    <>
                                                        <div className="font-semibold text-[11px] text-teal-800">{p.NM_BAIRRO || 'Sem nome'}</div>
                                                        <div className="text-slate-500 text-[9px] font-mono">{p.CD_BAIRRO}</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="font-mono text-[10px] text-blue-700 font-bold">{p.CD_SETOR}</div>
                                                        <div className="text-slate-500 text-[9px]">
                                                            {p.NM_BAIRRO && p.NM_BAIRRO !== '.' ? p.NM_BAIRRO : p.SITUACAO}
                                                            {p.CD_TIPO !== '0' && ` • Tipo ${p.CD_TIPO}`}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                {usesAggData ? (
                                                    <>
                                                        <div className="text-[10px] text-slate-700 font-semibold">{(p.v0001_agg || 0).toLocaleString('pt-BR')} hab</div>
                                                        <div className="text-[9px] text-slate-400">{(p.v0002_agg || 0).toLocaleString('pt-BR')} dom • {p.setores_count || 0} set.</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-[10px] text-slate-700 font-semibold">{(p.v0001 || 0).toLocaleString('pt-BR')} hab</div>
                                                        <div className="text-[9px] text-slate-400">{(p.v0002 || 0).toLocaleString('pt-BR')} dom • {p.pct_cobertura}%</div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : censusSectors ? (
                        <div className="p-3 text-slate-500 text-center">Nenhum {isSubdistritos ? 'subdistrito' : isBairros ? 'bairro' : 'setor'} encontrado nesta isócrona.</div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default CensusPanel;
