import { DEFAULT_API_KEY } from './api';

/**
 * Calcula isócronas via OpenRouteService API
 */
export const calculateIsochrone = async (coords, ranges, mode) => {
    const sortedRanges = [...ranges].sort((a, b) => a - b);
    const fator = 0.9;
    const apiRanges = sortedRanges.map((r) => r * 60 * fator);

    const body = {
        locations: [[coords[1], coords[0]]],
        range: apiRanges,
        range_type: 'time',
        profile: mode.id,
    };

    const response = await fetch(
        `https://api.openrouteservice.org/v2/isochrones/${mode.id}`,
        {
            method: 'POST',
            headers: {
                Authorization: DEFAULT_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) throw new Error(`Erro na API (${response.status}).`);

    const geoJsonData = await response.json();

    if (geoJsonData.features) {
        geoJsonData.features.sort((a, b) => b.properties.value - a.properties.value);
    }

    return geoJsonData;
};

/**
 * Retorna o estilo para cada feature da isócrona
 */
export const getIsochroneStyle = (feature, sortedRanges) => {
    const fator = 0.9;
    const val = feature.properties.value;
    let fillColor = '#10b981';
    let strokeColor = '#047857';

    if (
        val > sortedRanges[0] * 60 * fator + 10 &&
        val <= sortedRanges[1] * 60 * fator + 10
    ) {
        fillColor = '#FACC15';
        strokeColor = '#CA8A04';
    } else if (val > sortedRanges[1] * 60 * fator + 10) {
        fillColor = '#ef4444';
        strokeColor = '#991b1b';
    }

    return {
        color: strokeColor,
        weight: 2,
        opacity: 1,
        fillColor,
        fillOpacity: 0.25,
    };
};
