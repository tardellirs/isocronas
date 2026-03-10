import {
    fetchCensusSectorsAPI, fetchBairrosAPI, fetchSubdistritosAPI,
    SECTOR_DEFAULT_STYLE, SECTOR_HIGHLIGHT_STYLE,
    BAIRRO_DEFAULT_STYLE, BAIRRO_HIGHLIGHT_STYLE,
    SUBDIST_DEFAULT_STYLE, SUBDIST_HIGHLIGHT_STYLE,
} from './censusService';
import { downloadCensusCSV, downloadBairrosCSV, downloadSubdistritosCSV } from './csvExport';

export const MALHA_CONFIG = {
    setores: {
        idKey: 'CD_SETOR',
        label: 'Setores Censitários',
        labelShort: 'Setores',
        labelPlural: 'setores',
        labelSingular: 'setor',
        countKey: 'total_setores',
        accentColor: 'blue',
        emoji: '🗺️',
        usesAggData: false,
        defaultStyle: SECTOR_DEFAULT_STYLE,
        highlightStyle: SECTOR_HIGHLIGHT_STYLE,
        fetchAPI: fetchCensusSectorsAPI,
        downloadCSV: downloadCensusCSV,
        activeCls: 'bg-blue-500 text-white',
        inactiveCls: 'bg-white/60 text-slate-600 hover:bg-blue-50',
        listPrimary: (p) => p.CD_SETOR,
        listPrimaryClass: 'font-mono text-[10px] text-blue-700 font-bold',
        listSecondary: (p) => {
            let text = p.NM_BAIRRO && p.NM_BAIRRO !== '.' ? p.NM_BAIRRO : p.SITUACAO;
            if (p.CD_TIPO !== '0') text += ` • Tipo ${p.CD_TIPO}`;
            return text;
        },
        listSecondaryClass: 'text-slate-500 text-[9px]',
        buildPopup: (p) => `<div style="font-size:12px">
            <b>Setor: ${p.CD_SETOR}</b><br/>
            Bairro: ${p.NM_BAIRRO || 'N/A'}<br/>
            Situação: ${p.SITUACAO}<br/>
            População: ${(p.v0001 || 0).toLocaleString('pt-BR')}<br/>
            Domicílios: ${(p.v0002 || 0).toLocaleString('pt-BR')}<br/>
            Área: ${(p.AREA_KM2 || 0).toFixed(3)} km²
        </div>`,
    },
    bairros: {
        idKey: 'CD_BAIRRO',
        label: 'Bairros',
        labelShort: 'Bairros',
        labelPlural: 'bairros',
        labelSingular: 'bairro',
        countKey: 'total_bairros',
        accentColor: 'teal',
        emoji: '🏘️',
        usesAggData: true,
        defaultStyle: BAIRRO_DEFAULT_STYLE,
        highlightStyle: BAIRRO_HIGHLIGHT_STYLE,
        fetchAPI: fetchBairrosAPI,
        downloadCSV: downloadBairrosCSV,
        activeCls: 'bg-teal-500 text-white border-teal-400',
        inactiveCls: 'bg-white/60 text-slate-600 hover:bg-teal-50 border-slate-200/60',
        listPrimary: (p) => p.NM_BAIRRO || 'Sem nome',
        listPrimaryClass: 'font-semibold text-[11px] text-teal-800',
        listSecondary: (p) => p.CD_BAIRRO,
        listSecondaryClass: 'text-slate-500 text-[9px] font-mono',
        buildPopup: (p) => `<div style="font-size:12px">
            <b>Bairro: ${p.NM_BAIRRO || 'N/A'}</b><br/>
            Código: ${p.CD_BAIRRO}<br/>
            Município: ${p.NM_MUN}<br/>
            População: ${(p.v0001_agg || 0).toLocaleString('pt-BR')}<br/>
            Domicílios: ${(p.v0002_agg || 0).toLocaleString('pt-BR')}<br/>
            Setores: ${p.setores_count || 0}<br/>
            Área: ${(p.AREA_KM2 || 0).toFixed(3)} km²
        </div>`,
    },
    subdistritos: {
        idKey: 'CD_SUBDIST',
        label: 'Subdistritos',
        labelShort: 'Subdist.',
        labelPlural: 'subdistritos',
        labelSingular: 'subdistrito',
        countKey: 'total_subdistritos',
        accentColor: 'violet',
        emoji: '🏛️',
        usesAggData: true,
        defaultStyle: SUBDIST_DEFAULT_STYLE,
        highlightStyle: SUBDIST_HIGHLIGHT_STYLE,
        fetchAPI: fetchSubdistritosAPI,
        downloadCSV: downloadSubdistritosCSV,
        activeCls: 'bg-violet-500 text-white border-violet-400',
        inactiveCls: 'bg-white/60 text-slate-600 hover:bg-violet-50 border-slate-200/60',
        listPrimary: (p) => p.NM_SUBDIST || 'Sem nome',
        listPrimaryClass: 'font-semibold text-[11px] text-violet-800',
        listSecondary: (p) => p.CD_SUBDIST,
        listSecondaryClass: 'text-slate-500 text-[9px] font-mono',
        buildPopup: (p) => `<div style="font-size:12px">
            <b>Subdistrito: ${p.NM_SUBDIST || 'N/A'}</b><br/>
            Código: ${p.CD_SUBDIST}<br/>
            Município: ${p.NM_MUN}<br/>
            População: ${(p.v0001_agg || 0).toLocaleString('pt-BR')}<br/>
            Domicílios: ${(p.v0002_agg || 0).toLocaleString('pt-BR')}<br/>
            Setores: ${p.setores_count || 0}<br/>
            Área: ${(p.AREA_KM2 || 0).toFixed(3)} km²
        </div>`,
    },
};

export const MALHA_TYPES = Object.keys(MALHA_CONFIG);
