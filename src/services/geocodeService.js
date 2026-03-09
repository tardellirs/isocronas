/**
 * Serviço de geocodificação: Nominatim + IBGE API
 */

export const geocodeAddress = async (addrText) => {
    const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(addrText)}`
    );
    const data = await response.json();
    if (data && data.length > 0) {
        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
            name: data[0].display_name,
            address: data[0].address,
        };
    }
    return null;
};

export const reverseGeocode = async (lat, lon) => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
        );
        const data = await response.json();
        return data.display_name || `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
    } catch {
        return `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
    }
};

const normalize = (s) =>
    s
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

export const getMunicipioCodIBGE = async (lat, lon) => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`
        );
        const data = await response.json();
        const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.municipality;
        const state = data.address?.state;
        if (!city) return null;

        const ibgeResp = await fetch(
            'https://servicodados.ibge.gov.br/api/v1/localidades/municipios'
        );
        const municipios = await ibgeResp.json();

        const cityNorm = normalize(city);

        const found = municipios.find(
            (m) =>
                normalize(m.nome) === cityNorm &&
                (!state || normalize(m.microrregiao?.mesorregiao?.UF?.nome) === normalize(state))
        );

        if (found) return String(found.id);

        const partial = municipios.find((m) => normalize(m.nome) === cityNorm);
        return partial ? String(partial.id) : null;
    } catch (err) {
        console.error('Erro ao obter código IBGE:', err);
        return null;
    }
};
