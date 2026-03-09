import { BACKEND_URL } from './api';

/**
 * Busca setores censitários que intersectam a Faixa 1 da isócrona
 */
export const fetchCensusSectorsAPI = async (isochroneGeojson, cdMun) => {
    // Extrair Faixa 1 (menor isócrona / menor value)
    let faixa1Polygon = isochroneGeojson;
    if (
        isochroneGeojson.type === 'FeatureCollection' &&
        isochroneGeojson.features?.length > 0
    ) {
        const sorted = [...isochroneGeojson.features].sort(
            (a, b) => (a.properties?.value || 0) - (b.properties?.value || 0)
        );
        faixa1Polygon = sorted[0].geometry;
    } else if (isochroneGeojson.type === 'Feature') {
        faixa1Polygon = isochroneGeojson.geometry;
    }

    const response = await fetch(`${BACKEND_URL}/api/setores-isocrona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cd_mun: cdMun,
            isochrone_geojson: faixa1Polygon,
        }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Erro ${response.status}`);
    }

    return response.json();
};

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
