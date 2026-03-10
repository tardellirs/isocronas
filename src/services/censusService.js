import { BACKEND_URL } from './api';

/**
 * Busca setores censitários que intersectam a Faixa 1 da isócrona
 */
export const fetchCensusSectorsAPI = async (isochroneGeojson, cdMun) => {
    const faixa1 = _extractFaixa1(isochroneGeojson);

    const response = await fetch(`${BACKEND_URL}/api/setores-isocrona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cd_mun: cdMun, isochrone_geojson: faixa1 }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.detail || `Erro ${response.status}`);
    }
    return response.json();
};

/**
 * Busca bairros que intersectam a Faixa 1 da isócrona
 * (geometria do GeoPackage de bairros + dados agregados dos setores)
 */
export const fetchBairrosAPI = async (isochroneGeojson, cdMun) => {
    const faixa1 = _extractFaixa1(isochroneGeojson);

    const response = await fetch(`${BACKEND_URL}/api/bairros-isocrona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cd_mun: cdMun, isochrone_geojson: faixa1 }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.detail || `Erro ${response.status}`);
    }
    return response.json();
};

/**
 * Extrai a Faixa 1 (menor isócrona) do GeoJSON
 */
function _extractFaixa1(geojson) {
    if (geojson.type === 'FeatureCollection' && geojson.features?.length > 0) {
        const sorted = [...geojson.features].sort(
            (a, b) => (a.properties?.value || 0) - (b.properties?.value || 0)
        );
        return sorted[0].geometry;
    }
    if (geojson.type === 'Feature') return geojson.geometry;
    return geojson;
}

/**
 * Estilos para setores censitários no mapa
 */
export const SECTOR_DEFAULT_STYLE = {
    color: '#3b82f6',
    weight: 1.5,
    opacity: 0.8,
    fillColor: '#93c5fd',
    fillOpacity: 0.15,
};

export const SECTOR_HIGHLIGHT_STYLE = {
    color: '#ea580c',
    weight: 3,
    opacity: 1,
    fillColor: '#f97316',
    fillOpacity: 0.45,
};

/**
 * Estilos para bairros no mapa (verde-teal para diferenciar dos setores)
 */
export const BAIRRO_DEFAULT_STYLE = {
    color: '#0d9488',
    weight: 2,
    opacity: 0.8,
    fillColor: '#5eead4',
    fillOpacity: 0.15,
};

export const BAIRRO_HIGHLIGHT_STYLE = {
    color: '#ea580c',
    weight: 3,
    opacity: 1,
    fillColor: '#f97316',
    fillOpacity: 0.45,
};

/**
 * Busca subdistritos que intersectam a Faixa 1 da isócrona
 * (geometria do GeoPackage de subdistritos + dados agregados dos setores)
 */
export const fetchSubdistritosAPI = async (isochroneGeojson, cdMun) => {
    const faixa1 = _extractFaixa1(isochroneGeojson);

    const response = await fetch(`${BACKEND_URL}/api/subdistritos-isocrona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cd_mun: cdMun, isochrone_geojson: faixa1 }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.detail || `Erro ${response.status}`);
    }
    return response.json();
};

/**
 * Estilos para subdistritos no mapa (violet para diferenciar de setores e bairros)
 */
export const SUBDIST_DEFAULT_STYLE = {
    color: '#7c3aed',
    weight: 2,
    opacity: 0.8,
    fillColor: '#c4b5fd',
    fillOpacity: 0.15,
};

export const SUBDIST_HIGHLIGHT_STYLE = {
    color: '#ea580c',
    weight: 3,
    opacity: 1,
    fillColor: '#f97316',
    fillOpacity: 0.45,
};
