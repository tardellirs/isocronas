import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { marked } from 'marked';

import { MODES, DEFAULT_API_KEY, GEMINI_API_KEY } from './services/api';
import { geocodeAddress, reverseGeocode, getMunicipioCodIBGE } from './services/geocodeService';
import { calculateIsochrone, getIsochroneStyle } from './services/isochroneService';
import { fetchCensusSectorsAPI, SECTOR_DEFAULT_STYLE, SECTOR_HIGHLIGHT_STYLE } from './services/censusService';
import { fetchPOIsAPI, classifyPOI } from './services/poiService';
import { downloadCensusCSV } from './services/csvExport';

import Icon from './components/Icon';
import HelpModal from './components/HelpModal';
import CensusPanel from './components/CensusPanel';
import MapLegend from './components/MapLegend';

function App() {
    // --- Refs ---
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);
    const polygonLayerRef = useRef(null);
    const poiLayerRef = useRef(null);
    const censusLayerRef = useRef(null);
    const highlightLayerRef = useRef(null);
    const lastGeoJsonRef = useRef(null);
    const sectorLayersRef = useRef({});

    // --- Estado: Endereço e Mapa ---
    const [address, setAddress] = useState('São José dos Campos, Brasil');
    const [coordinates, setCoordinates] = useState([-23.1896, -45.8841]);
    const [mode, setMode] = useState(MODES[0]);
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [sheetState, setSheetState] = useState('medium'); // 'collapsed' | 'medium' | 'expanded'

    // --- Estado: Faixas ---
    const [range1, setRange1] = useState(10);
    const [range2, setRange2] = useState(20);
    const [range3, setRange3] = useState(30);

    // --- Estado: Loading / erros ---
    const [loading, setLoading] = useState(false);
    const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
    const [errorMsg, setErrorMsg] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [isAddressDirty, setIsAddressDirty] = useState(false);

    // --- Estado: IA ---
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [showAiResult, setShowAiResult] = useState(false);
    const [isAiExpanded, setIsAiExpanded] = useState(true);
    const [showMapLegend, setShowMapLegend] = useState(false);

    // --- Estado: POIs ---
    const [showPOIs, setShowPOIs] = useState(false);
    const [loadingPOIs, setLoadingPOIs] = useState(false);
    const [foundPOIs, setFoundPOIs] = useState([]);

    // --- Estado: Setores Censitários ---
    const [censusSectors, setCensusSectors] = useState(null);
    const [loadingCensus, setLoadingCensus] = useState(false);
    const [isCensusExpanded, setIsCensusExpanded] = useState(true);
    const [activeSectorId, setActiveSectorId] = useState(null);
    const [currentCdMun, setCurrentCdMun] = useState(null);
    const [showCensus, setShowCensus] = useState(false);

    // --- Effects ---
    useEffect(() => {
        const savedKey = localStorage.getItem('ors_api_key');
        if (savedKey) setApiKey(savedKey);
    }, []);

    useEffect(() => {
        if (apiKey) localStorage.setItem('ors_api_key', apiKey);
    }, [apiKey]);

    useEffect(() => {
        if (!mapInstanceRef.current) {
            mapInstanceRef.current = L.map('map', {
                zoomControl: false,
                attributionControl: false,
            }).setView(coordinates, 13);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OSM contributors',
                maxZoom: 19,
            }).addTo(mapInstanceRef.current);

            L.control.zoom({ position: 'topright' }).addTo(mapInstanceRef.current);
            poiLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

            mapInstanceRef.current.on('click', (e) => {
                const { lat, lng } = e.latlng;
                updateLocation([lat, lng], true);
                // Auto-collapse bottom sheet on mobile map click
                if (window.innerWidth < 768) setSheetState('collapsed');
            });
        }
    }, []);

    useEffect(() => {
        if (mapInstanceRef.current) {
            const map = mapInstanceRef.current;
            if (markerRef.current) {
                markerRef.current.setLatLng(coordinates);
            } else {
                const customIcon = L.divIcon({
                    className: 'custom-pin',
                    html: '<div style="background-color: #4f46e5; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                });
                markerRef.current = L.marker(coordinates, { icon: customIcon }).addTo(map);
            }
            map.setView(coordinates, 13, { animate: true });
            if (showPOIs) fetchPOIs(coordinates);
        }
    }, [coordinates]);

    // --- POIs ---
    const fetchPOIs = async (coords) => {
        if (!mapInstanceRef.current) return;
        setLoadingPOIs(true);
        poiLayerRef.current.clearLayers();
        setFoundPOIs([]);

        try {
            const data = await fetchPOIsAPI(coords, range3);
            const poisFound = [];

            data.elements.forEach((el) => {
                const pLat = el.lat || el.center?.lat;
                const pLon = el.lon || el.center?.lon;
                if (!pLat || !pLon) return;

                const { type, name, iconHtml, className } = classifyPOI(el);
                if (name !== 'Local sem nome') poisFound.push(`${name} (${type})`);

                const customIcon = L.divIcon({
                    className,
                    html: iconHtml,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                });

                L.marker([pLat, pLon], { icon: customIcon })
                    .bindPopup(`<b>${name}</b><br>${type}`)
                    .addTo(poiLayerRef.current);
            });

            setFoundPOIs(poisFound);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoadingPOIs(false);
        }
    };

    const togglePOIs = () => {
        const newState = !showPOIs;
        setShowPOIs(newState);
        if (newState) fetchPOIs(coordinates);
        else poiLayerRef.current.clearLayers();
    };

    // --- Isócrona estilos ---
    const updateIsochroneStyle = (censusActive) => {
        if (!polygonLayerRef.current) return;
        const sortedRanges = [range1, range2, range3].sort((a, b) => a - b);
        const fator = 0.9;
        const faixa1Max = sortedRanges[0] * 60 * fator + 10;

        polygonLayerRef.current.eachLayer((layer) => {
            const val = layer.feature?.properties?.value;
            if (val === undefined) return;
            const isFaixa1 = val <= faixa1Max;

            if (censusActive) {
                layer.setStyle({
                    color: isFaixa1 ? '#047857' : 'transparent',
                    weight: isFaixa1 ? 3 : 0,
                    opacity: isFaixa1 ? 1 : 0,
                    fillOpacity: 0,
                });
                // Desabilita cliques na isócrona para não bloquear os setores censitários
                if (layer._path) layer._path.style.pointerEvents = 'none';
            } else {
                let fillColor = '#10b981';
                let strokeColor = '#047857';
                if (val > faixa1Max && val <= sortedRanges[1] * 60 * fator + 10) {
                    fillColor = '#FACC15'; strokeColor = '#CA8A04';
                } else if (val > sortedRanges[1] * 60 * fator + 10) {
                    fillColor = '#ef4444'; strokeColor = '#991b1b';
                }
                layer.setStyle({
                    color: strokeColor, weight: 2, opacity: 1,
                    fillColor, fillOpacity: 0.25,
                });
                // Reabilita cliques na isócrona
                if (layer._path) layer._path.style.pointerEvents = '';
            }
        });
    };

    // --- Setores Censitários ---
    const toggleCensus = async () => {
        const newState = !showCensus;
        setShowCensus(newState);
        if (newState) {
            updateIsochroneStyle(true);
            if (lastGeoJsonRef.current && currentCdMun) {
                fetchCensusSectors(lastGeoJsonRef.current, currentCdMun);
            } else {
                setErrorMsg('Calcule a isócrona primeiro.');
                setShowCensus(false);
            }
        } else {
            if (censusLayerRef.current) {
                mapInstanceRef.current.removeLayer(censusLayerRef.current);
                censusLayerRef.current = null;
            }
            if (highlightLayerRef.current) {
                mapInstanceRef.current.removeLayer(highlightLayerRef.current);
                highlightLayerRef.current = null;
            }
            setCensusSectors(null);
            setActiveSectorId(null);
            updateIsochroneStyle(false);
        }
    };

    const fetchCensusSectors = async (isochroneGeojson, cdMun) => {
        if (!cdMun) return;
        setLoadingCensus(true);
        setCensusSectors(null);
        setActiveSectorId(null);

        if (censusLayerRef.current) {
            mapInstanceRef.current.removeLayer(censusLayerRef.current);
            censusLayerRef.current = null;
        }
        if (highlightLayerRef.current) {
            mapInstanceRef.current.removeLayer(highlightLayerRef.current);
            highlightLayerRef.current = null;
        }

        try {
            const data = await fetchCensusSectorsAPI(isochroneGeojson, cdMun);
            setCensusSectors(data);

            if (mapInstanceRef.current && data.features?.length > 0) {
                sectorLayersRef.current = {};
                censusLayerRef.current = L.geoJSON(data, {
                    style: SECTOR_DEFAULT_STYLE,
                    onEachFeature: (feature, layer) => {
                        const p = feature.properties;
                        sectorLayersRef.current[p.CD_SETOR] = layer;
                        layer.bindPopup(
                            `<div style="font-size:12px">
                <b>Setor: ${p.CD_SETOR}</b><br/>
                Bairro: ${p.NM_BAIRRO || 'N/A'}<br/>
                Situação: ${p.SITUACAO}<br/>
                População: ${(p.v0001 || 0).toLocaleString('pt-BR')}<br/>
                Domicílios: ${(p.v0002 || 0).toLocaleString('pt-BR')}<br/>
                Área: ${(p.AREA_KM2 || 0).toFixed(3)} km²
              </div>`
                        );
                        layer.on('click', () => highlightSector(p.CD_SETOR));
                    },
                }).addTo(mapInstanceRef.current);

                // Traz a borda da Faixa 1 para frente (acima dos setores censitários)
                if (polygonLayerRef.current) {
                    polygonLayerRef.current.eachLayer((layer) => {
                        const val = layer.feature?.properties?.value;
                        if (val === undefined) return;
                        const sortedRanges = [range1, range2, range3].sort((a, b) => a - b);
                        const faixa1Max = sortedRanges[0] * 60 * 0.9 + 10;
                        if (val <= faixa1Max) {
                            layer.bringToFront();
                        }
                    });
                }
            }
        } catch (err) {
            console.error('Erro setores censitários:', err);
            setErrorMsg(`Setores: ${err.message}. Verifique se o servidor backend está ativo.`);
        } finally {
            setLoadingCensus(false);
        }
    };

    const highlightSector = (cdSetor) => {
        if (!mapInstanceRef.current) return;
        setActiveSectorId(cdSetor);

        Object.entries(sectorLayersRef.current).forEach(([key, layer]) => {
            if (key === cdSetor) {
                layer.setStyle(SECTOR_HIGHLIGHT_STYLE);
                layer.bringToFront();
                layer.openPopup();
            } else {
                layer.setStyle(SECTOR_DEFAULT_STYLE);
            }
        });
    };

    // --- Busca e Navegação ---
    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        await performSearch();
    };

    const performSearch = async () => {
        setSearchLoading(true);
        setErrorMsg('');
        try {
            const result = await geocodeAddress(address);
            if (result) updateLocation([result.lat, result.lon], false);
            else setErrorMsg('Endereço não encontrado.');
        } catch {
            setErrorMsg('Erro na busca.');
        } finally {
            setSearchLoading(false);
        }
    };

    const updateLocation = async (coords, fromMapClick) => {
        setCoordinates(coords);
        setErrorMsg('');
        setIsAddressDirty(false);
        setAiAnalysis('');
        setShowAiResult(false);
        setIsAiExpanded(true);
        if (window.innerWidth < 768) setIsPanelOpen(false);

        if (fromMapClick) {
            setAddress('Obtendo endereço...');
            const revAddress = await reverseGeocode(coords[0], coords[1]);
            setAddress(revAddress);
        }
    };

    const handleAddressChange = (e) => {
        setAddress(e.target.value);
        setIsAddressDirty(true);
    };

    // --- IA ---
    const handleAnalyzeWithGemini = async () => {
        if (!address || address === 'Local selecionado no mapa' || address === 'Obtendo endereço...') {
            setErrorMsg('Por favor, aguarde o endereço carregar ou busque um local.');
            return;
        }

        setAiLoading(true);
        setShowAiResult(true);
        setIsAiExpanded(true);
        setAiAnalysis('');
        setIsPanelOpen(true);

        try {
            const sortedRanges = [range1, range2, range3].sort((a, b) => a - b);
            let poiText = '';
            if (foundPOIs.length > 0) {
                const limitedPois = foundPOIs.slice(0, 15).join(', ');
                poiText = `\n\n**Pontos de Interesse REAIS detectados no mapa:** ${limitedPois}. (Use estes dados para enriquecer a análise de serviços).`;
            }

            const prompt = `Atue como um especialista em inteligência de mercado imobiliário. Analise o endereço: "${address}".
      
      Dados de mobilidade (${mode.label}): ${sortedRanges[0]} min, ${sortedRanges[1]} min, ${sortedRanges[2]} min.
      ${poiText}

      Inicie a resposta EXATAMENTE com a frase: "**Relatório de inteligência Imobiliária para o endereço ${address}**".
      
      Forneça um relatório **resumido e tabelado** focando em dados para investidores/moradores:

      ### 1. 🏢 Perfil e Vocação
      * **Perfil do Bairro:** (Residencial / Misto / Comercial / Universitário)
      * **Público-Alvo:** (Famílias, Estudantes, Singles, Executivos)
      * **Veredito:** Uma frase sobre o potencial da área.

      ### 2. 🚦 Raio de Serviços (Tabela)
      | Tempo | O que acessar (Principais Serviços/Lazer) |
      | :--- | :--- |
      | **${sortedRanges[0]} min** | (Liste 2 itens essenciais próximos) |
      | **${sortedRanges[2]} min** | (Liste 2 diferenciais regionais) |

      ### 3. 💰 Análise de Mercado
      * **Padrão Construtivo Predominante:** (Baixo / Médio / Alto / Luxo)
      * **Potencial de Valorização:** (Estável / Alta / Baixa)
      
      **Estimativa de Preço m² por Tipologia (Venda):**
      | Tipologia | Faixa Estimada (R$/m²) |
      | :--- | :--- |
      | **Apartamento** | (Insira estimativa) |
      | **Casa** | (Insira estimativa) |
      | **Casa de Condomínio** | (Insira estimativa) |

      Seja direto, objetivo e use formatação Markdown. Responda em Português.`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                }
            );

            if (!response.ok) throw new Error('Erro ao conectar com Gemini.');
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar a análise.';
            setAiAnalysis(text);
        } catch (err) {
            setAiAnalysis(`⚠️ Erro na análise de IA: ${err.message}. Tente novamente.`);
        } finally {
            setAiLoading(false);
        }
    };

    // --- Calcular Isócrona ---
    const handleCalculate = async () => {
        setLoading(true);
        setErrorMsg('');
        setShowMapLegend(false);
        setCensusSectors(null);

        if (isAddressDirty && address !== 'Local selecionado no mapa') {
            try {
                const result = await geocodeAddress(address);
                if (result) setCoordinates([result.lat, result.lon]);
                else { setErrorMsg('Endereço digitado não encontrado.'); setLoading(false); return; }
            } catch { setErrorMsg('Erro ao buscar o novo endereço.'); setLoading(false); return; }
        }

        if (polygonLayerRef.current) {
            mapInstanceRef.current.removeLayer(polygonLayerRef.current);
            polygonLayerRef.current = null;
        }
        if (censusLayerRef.current) {
            mapInstanceRef.current.removeLayer(censusLayerRef.current);
            censusLayerRef.current = null;
        }
        if (highlightLayerRef.current) {
            mapInstanceRef.current.removeLayer(highlightLayerRef.current);
            highlightLayerRef.current = null;
        }

        let targetCoords = coordinates;
        if (isAddressDirty) {
            const result = await geocodeAddress(address);
            if (result) targetCoords = [result.lat, result.lon];
        }

        const cdMunPromise = getMunicipioCodIBGE(targetCoords[0], targetCoords[1]);

        try {
            const sortedRanges = [range1, range2, range3].sort((a, b) => a - b);
            const geoJsonData = await calculateIsochrone(targetCoords, sortedRanges, mode);

            if (mapInstanceRef.current && geoJsonData) {
                polygonLayerRef.current = L.geoJSON(geoJsonData, {
                    style: (feature) => getIsochroneStyle(feature, sortedRanges),
                }).addTo(mapInstanceRef.current);
                mapInstanceRef.current.fitBounds(polygonLayerRef.current.getBounds(), { padding: [20, 20] });
                setShowMapLegend(true);

                if (window.innerWidth < 768) setSheetState('collapsed');
                if (showPOIs) fetchPOIs(targetCoords);

                lastGeoJsonRef.current = geoJsonData;

                const cdMun = await cdMunPromise;
                if (cdMun) setCurrentCdMun(cdMun);
                else console.warn('Não foi possível determinar o município');

                setShowCensus(false);
                setCensusSectors(null);
            }
        } catch (err) {
            setErrorMsg(`Erro: ${err.message}`);
        } finally {
            setLoading(false);
            setIsAddressDirty(false);
        }
    };

    const sortedLegend = [range1, range2, range3].sort((a, b) => a - b);

    // --- Mobile sheet height classes ---
    const sheetHeightClass = {
        collapsed: 'h-[60px]',
        medium: 'h-[50vh]',
        expanded: 'h-[85vh]',
    }[sheetState];

    const cycleSheet = () => {
        setSheetState(prev => {
            if (prev === 'collapsed') return 'medium';
            if (prev === 'medium') return 'expanded';
            return 'collapsed';
        });
    };

    // --- Render ---
    return (
        <div className="relative h-screen w-screen bg-slate-900 flex flex-col md:flex-row overflow-hidden">

            {/* ══════════════════════════════════════════════════════════
                Sidebar (Desktop) / Bottom Sheet (Mobile)
                ══════════════════════════════════════════════════════════ */}
            <div
                className={`
                    fixed bottom-0 left-0 w-full z-[1000] glass shadow-2xl
                    transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                    md:relative md:w-[400px] md:h-full md:shadow-xl flex flex-col
                    ${sheetHeightClass} md:!h-full
                    rounded-t-2xl md:rounded-none
                `}
            >
                {/* ── Mobile Handle ─────────────────────────────────── */}
                <div
                    className="md:hidden pt-2.5 pb-1 cursor-pointer shrink-0"
                    onClick={cycleSheet}
                >
                    <div className="sheet-handle" />
                </div>

                {/* ── Header ───────────────────────────────────────── */}
                <div
                    className="px-4 py-3 glass-dark text-white flex justify-between items-center cursor-pointer md:cursor-default md:rounded-none shrink-0"
                    onClick={() => { if (window.innerWidth < 768) cycleSheet(); }}
                >
                    <div>
                        <h1 className="text-base font-bold flex items-center gap-2 tracking-tight">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                <Icon name="mapPin" className="text-indigo-300" size={16} />
                            </div>
                            M2G2 Isócronas
                        </h1>
                        <p className="text-slate-400 text-[10px] mt-0.5 ml-9 font-medium tracking-wide">Inteligência Imobiliária & Mobilidade</p>
                    </div>
                    <div className="md:hidden text-slate-400">
                        <Icon name={sheetState === 'expanded' ? 'chevronDown' : 'chevronUp'} size={20} />
                    </div>
                </div>

                {/* ── Content ──────────────────────────────────────── */}
                <div className={`flex-1 overflow-y-auto custom-scroll bg-white/50 ${sheetState === 'collapsed' ? 'hidden md:block' : ''}`}>
                    <div className="p-4 space-y-4">

                        {/* ── Endereço ──────────────────────────────── */}
                        <div className="space-y-1.5 animate-fade-in">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Ponto de Partida</label>
                            <form onSubmit={handleSearchSubmit} className="relative group">
                                <input
                                    type="text" value={address}
                                    onChange={handleAddressChange}
                                    className={`w-full pl-9 pr-3 py-2.5 bg-white/80 backdrop-blur-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 text-sm transition-all shadow-sm ${isAddressDirty ? 'border-indigo-300 ring-1 ring-indigo-200/50' : 'border-slate-200/80'}`}
                                    placeholder="Digite um endereço..."
                                />
                                <Icon name="search" className="absolute left-2.5 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                {searchLoading && <div className="absolute right-3 top-2.5"><div className="spinner !border-indigo-200 !border-t-indigo-600 !w-4 !h-4"></div></div>}
                            </form>
                            {isAddressDirty && <p className="text-[10px] text-indigo-500 animate-pulse-soft font-medium">Pressione Enter ou Calcular para buscar</p>}
                        </div>

                        {/* ── Transporte ────────────────────────────── */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Transporte</label>
                            <div className="grid grid-cols-3 gap-2">
                                {MODES.map((m) => (
                                    <button
                                        key={m.id} onClick={() => setMode(m)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 min-h-[56px] ${mode.id === m.id
                                            ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-md shadow-indigo-100'
                                            : 'bg-white/60 border-slate-200/60 text-slate-500 hover:bg-white hover:border-slate-300'
                                            }`}
                                    >
                                        <Icon name={m.icon} className="mb-0.5" size={20} />
                                        <span className="text-[10px] font-semibold">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Faixas ────────────────────────────────── */}
                        <div className="space-y-3 pt-3 border-t border-slate-200/50">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Faixas de Tempo</label>

                            {[
                                { label: 'Faixa 1', color: 'emerald', val: range1, set: setRange1, slider: 'slider-green' },
                                { label: 'Faixa 2', color: 'yellow', val: range2, set: setRange2, slider: 'slider-yellow' },
                                { label: 'Faixa 3', color: 'red', val: range3, set: setRange3, slider: 'slider-red' },
                            ].map(({ label, color, val, set, slider }) => (
                                <div key={label} className="space-y-1">
                                    <div className="flex justify-between items-center text-xs">
                                        <div className={`flex items-center gap-1.5 text-${color}-600 font-bold`}>
                                            <div className={`w-2 h-2 rounded-full bg-${color}-500`}></div>
                                            {label}
                                        </div>
                                        <span className={`bg-${color}-50 text-${color}-700 px-2 py-0.5 rounded-full border border-${color}-200/50 font-mono text-[10px] font-semibold`}>{val} min</span>
                                    </div>
                                    <input type="range" min="1" max="60" value={val} onChange={(e) => set(parseInt(e.target.value))} className={`w-full h-1.5 rounded-lg cursor-pointer ${slider}`} />
                                </div>
                            ))}
                        </div>

                        {/* ── Botões de Ação ────────────────────────── */}
                        <div className="flex flex-col gap-2.5 pt-1">
                            <button
                                onClick={handleCalculate} disabled={loading}
                                className={`w-full py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 text-sm ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'btn-primary'}`}
                            >
                                {loading ? <div className="spinner !w-4 !h-4"></div> : <Icon name="mapPin" size={16} />}
                                {loading ? 'Calculando...' : 'Calcular Alcance'}
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={togglePOIs}
                                    className={`py-2.5 border-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 text-[11px] btn-secondary ${showPOIs
                                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                                        : 'bg-white/60 border-slate-200/60 text-slate-600 hover:bg-white'
                                        }`}
                                >
                                    {loadingPOIs ? <div className="spinner !w-3 !h-3 !border-slate-400 !border-t-transparent"></div> : <span>📍</span>}
                                    {showPOIs ? 'Ocultar POIs' : 'POIs'}
                                </button>

                                <button
                                    onClick={toggleCensus}
                                    disabled={loadingCensus || !lastGeoJsonRef.current}
                                    className={`py-2.5 border-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 text-[11px] btn-secondary ${showCensus
                                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                                        : 'bg-white/60 border-slate-200/60 text-slate-600 hover:bg-white'
                                        } ${!lastGeoJsonRef.current ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    {loadingCensus ? <div className="spinner !w-3 !h-3 !border-blue-400 !border-t-blue-700"></div> : <span>🗺️</span>}
                                    {showCensus ? 'Ocultar IBGE' : 'Setores IBGE'}
                                </button>
                            </div>
                        </div>

                        {/* ── IA ────────────────────────────────────── */}
                        {!loading && !errorMsg && (
                            <button
                                onClick={handleAnalyzeWithGemini}
                                disabled={aiLoading}
                                className="w-full py-3.5 btn-ai text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                            >
                                {aiLoading ? <div className="spinner !w-4 !h-4"></div> : <span>✨</span>}
                                {aiLoading ? 'Analisando...' : 'Análise com IA'}
                            </button>
                        )}

                        {/* ── Painel IA ─────────────────────────────── */}
                        {showAiResult && (
                            <div className="glass-panel border border-indigo-200/50 rounded-xl text-xs overflow-hidden animate-fade-in-up">
                                <div
                                    className="p-3 flex justify-between items-center cursor-pointer hover:bg-indigo-50/50 transition-colors"
                                    onClick={() => setIsAiExpanded(!isAiExpanded)}
                                >
                                    <h3 className="font-bold text-indigo-800 flex items-center gap-2 m-0 border-0">
                                        <span>✨</span>
                                        Relatório da Região
                                    </h3>
                                    <button className="text-indigo-400 hover:text-indigo-700 transition-colors">
                                        <Icon name={isAiExpanded ? 'chevronUp' : 'chevronDown'} size={16} />
                                    </button>
                                </div>

                                {isAiExpanded && (
                                    <div className="p-3 pt-0 border-t border-indigo-100/50 max-h-[40vh] overflow-y-auto custom-scroll">
                                        {aiAnalysis ? (
                                            <div className="prose prose-sm text-gray-700" dangerouslySetInnerHTML={{ __html: marked.parse(aiAnalysis) }} />
                                        ) : (
                                            <div className="text-indigo-400 flex flex-col items-center py-4">
                                                <div className="spinner !border-indigo-200 !border-t-indigo-600 mb-2"></div>
                                                <span className="text-xs">Consultando IA...</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Painel Censitário ────────────────────── */}
                        <CensusPanel
                            loadingCensus={loadingCensus}
                            censusSectors={censusSectors}
                            isCensusExpanded={isCensusExpanded}
                            setIsCensusExpanded={setIsCensusExpanded}
                            activeSectorId={activeSectorId}
                            highlightSector={highlightSector}
                            onDownload={() => downloadCensusCSV(censusSectors)}
                        />

                        {errorMsg && <div className="text-red-600 text-xs bg-red-50/80 backdrop-blur p-2.5 rounded-xl border border-red-200/50 animate-fade-in">{errorMsg}</div>}
                        <div className="h-8 md:hidden"></div>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                Mapa
                ══════════════════════════════════════════════════════════ */}
            <div id="map" className="flex-1 bg-slate-200 relative">
                {showMapLegend && (
                    <MapLegend sortedLegend={sortedLegend} censusSectors={censusSectors} />
                )}
            </div>
        </div>
    );
}

export default App;
