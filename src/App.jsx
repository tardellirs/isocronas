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

                if (window.innerWidth < 768) setIsPanelOpen(false);
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

    // --- Render ---
    return (
        <div className="relative h-screen w-screen bg-gray-100 flex flex-col md:flex-row overflow-hidden">

            {/* Sidebar */}
            <div
                className={`
          fixed left-0 w-full z-[1000] bg-white shadow-2xl transition-transform duration-300 ease-in-out
          md:relative md:w-[400px] md:h-full md:shadow-xl md:translate-y-0 flex flex-col
          ${isPanelOpen ? 'translate-y-0 bottom-0 h-[75vh] md:h-full' : 'translate-y-[calc(100%-60px)] bottom-0 h-[75vh] md:translate-y-0'}
          rounded-t-2xl md:rounded-none
        `}
            >
                {/* Header */}
                <div
                    className="p-4 bg-indigo-700 text-white shadow-md flex justify-between items-center cursor-pointer md:cursor-default rounded-t-2xl md:rounded-none shrink-0"
                    onClick={() => { if (window.innerWidth < 768) setIsPanelOpen(!isPanelOpen); }}
                >
                    <div>
                        <h1 className="text-lg font-bold flex items-center gap-2">
                            <Icon name="mapPin" className="text-indigo-200" />
                            M2G2 - Isócronas
                        </h1>
                        <p className="text-indigo-200 text-[10px] mt-0.5">Inteligência Imobiliária & Mobilidade</p>
                    </div>
                    <div className="md:hidden text-indigo-200">
                        <Icon name={isPanelOpen ? 'chevronDown' : 'chevronUp'} size={24} />
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 space-y-3 overflow-y-auto custom-scroll bg-white">

                    {/* Endereço */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ponto de Partida</label>
                        <form onSubmit={handleSearchSubmit} className="relative">
                            <input
                                type="text" value={address}
                                onChange={handleAddressChange}
                                className={`w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors ${isAddressDirty ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'}`}
                                placeholder="Digite um endereço..."
                            />
                            <Icon name="search" className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                            {searchLoading && <div className="absolute right-3 top-2.5"><div className="spinner !border-indigo-200 !border-t-indigo-600 !w-4 !h-4"></div></div>}
                        </form>
                        {isAddressDirty && <p className="text-[10px] text-indigo-600 animate-pulse">Pressione Enter ou Calcular para buscar</p>}
                    </div>

                    {/* Transporte */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transporte</label>
                        <div className="grid grid-cols-3 gap-2">
                            {MODES.map((m) => (
                                <button
                                    key={m.id} onClick={() => setMode(m)}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${mode.id === m.id ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <Icon name={m.icon} className="mb-1" size={18} />
                                    <span className="text-[10px] font-medium">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Faixas */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Faixas de Tempo (Min)</label>
                        <div className="space-y-0.5">
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5 text-emerald-600 font-bold">Faixa 1</div>
                                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100 font-mono text-[10px]">{range1} min</span>
                            </div>
                            <input type="range" min="1" max="60" value={range1} onChange={(e) => setRange1(parseInt(e.target.value))} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer slider-green" />
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5 text-yellow-600 font-bold">Faixa 2</div>
                                <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-100 font-mono text-[10px]">{range2} min</span>
                            </div>
                            <input type="range" min="1" max="60" value={range2} onChange={(e) => setRange2(parseInt(e.target.value))} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer slider-yellow" />
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5 text-red-600 font-bold">Faixa 3</div>
                                <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100 font-mono text-[10px]">{range3} min</span>
                            </div>
                            <input type="range" min="1" max="60" value={range3} onChange={(e) => setRange3(parseInt(e.target.value))} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer slider-red" />
                        </div>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleCalculate} disabled={loading}
                            className={`w-full py-3 rounded-xl text-white font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 text-sm ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                            {loading ? <div className="spinner !w-4 !h-4"></div> : <Icon name="mapPin" size={16} />}
                            {loading ? 'Atualizando...' : 'Calcular Alcance'}
                        </button>

                        <button
                            onClick={togglePOIs}
                            className={`w-full py-2.5 border rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-xs ${showPOIs ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            {loadingPOIs ? <div className="spinner !w-3 !h-3 !border-gray-400 !border-t-transparent"></div> : <Icon name="search" size={14} />}
                            {showPOIs ? 'Ocultar Pontos de Interesse' : '📍 Mostrar Pontos de Interesse'}
                        </button>

                        <button
                            onClick={toggleCensus}
                            disabled={loadingCensus || !lastGeoJsonRef.current}
                            className={`w-full py-2.5 border rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-xs ${showCensus ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'} ${!lastGeoJsonRef.current ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loadingCensus ? <div className="spinner !w-3 !h-3 !border-blue-400 !border-t-blue-700"></div> : <Icon name="layers" size={14} />}
                            {showCensus ? 'Ocultar Setores Censitários' : '🗺️ Selecionar Setor Censitário'}
                        </button>
                    </div>

                    {/* IA */}
                    {!loading && !errorMsg && (
                        <button
                            onClick={handleAnalyzeWithGemini}
                            disabled={aiLoading}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl shadow-md font-medium flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all text-sm"
                        >
                            {aiLoading ? <div className="spinner !w-4 !h-4"></div> : <Icon name="home" size={16} />}
                            {aiLoading ? 'Analisando...' : 'Análise Imobiliária com IA'}
                        </button>
                    )}

                    {/* Painel IA */}
                    {showAiResult && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl text-xs overflow-hidden transition-all duration-300">
                            <div
                                className="p-3 flex justify-between items-center cursor-pointer hover:bg-indigo-100"
                                onClick={() => setIsAiExpanded(!isAiExpanded)}
                            >
                                <h3 className="font-bold text-indigo-800 flex items-center gap-2 m-0 border-0">
                                    <Icon name="home" size={14} className="text-indigo-600" />
                                    Relatório da Região
                                </h3>
                                <button className="text-indigo-400 hover:text-indigo-700">
                                    <Icon name={isAiExpanded ? 'chevronUp' : 'chevronDown'} size={16} />
                                </button>
                            </div>

                            {isAiExpanded && (
                                <div className="p-3 pt-0 border-t border-indigo-100 max-h-[40vh] overflow-y-auto custom-scroll">
                                    {aiAnalysis ? (
                                        <div className="prose prose-sm text-gray-700" dangerouslySetInnerHTML={{ __html: marked.parse(aiAnalysis) }} />
                                    ) : (
                                        <div className="text-indigo-400 flex flex-col items-center py-4">
                                            <div className="spinner !border-indigo-200 !border-t-indigo-600 mb-2"></div>
                                            <span>Consultando dados imobiliários...</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Painel Censitário */}
                    <CensusPanel
                        loadingCensus={loadingCensus}
                        censusSectors={censusSectors}
                        isCensusExpanded={isCensusExpanded}
                        setIsCensusExpanded={setIsCensusExpanded}
                        activeSectorId={activeSectorId}
                        highlightSector={highlightSector}
                        onDownload={() => downloadCensusCSV(censusSectors)}
                    />

                    {errorMsg && <div className="text-red-600 text-xs bg-red-50 p-2 rounded">{errorMsg}</div>}
                    <div className="h-16 md:hidden"></div>
                </div>
            </div>

            {/* Mapa */}
            <div id="map" className="flex-1 bg-gray-200 relative">
                {showMapLegend && (
                    <MapLegend sortedLegend={sortedLegend} censusSectors={censusSectors} />
                )}
            </div>
        </div>
    );
}

export default App;
