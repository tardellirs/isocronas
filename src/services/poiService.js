/**
 * Busca pontos de interesse via Overpass API
 */
export const fetchPOIsAPI = async (coords, maxRadius) => {
    const radius = Math.min(maxRadius * 100, 5000);
    const [lat, lon] = coords;

    const query = `
    [out:json][timeout:90];
    (
      nwr["amenity"="pharmacy"](around:${radius},${lat},${lon});
      nwr["shop"="mall"](around:${radius},${lat},${lon});
      nwr["amenity"="marketplace"](around:${radius},${lat},${lon});
      nwr["shop"="supermarket"](around:${radius},${lat},${lon});
      nwr["amenity"="school"](around:${radius},${lat},${lon});
      nwr["amenity"="university"](around:${radius},${lat},${lon});
      nwr["amenity"="hospital"](around:${radius},${lat},${lon});
      nwr["leisure"="park"](around:${radius},${lat},${lon});
      nwr["aeroway"="aerodrome"](around:${radius},${lat},${lon});
    );
    out center;
  `;

    const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
    ];

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: 'data=' + encodeURIComponent(query),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            if (!response.ok) throw new Error(`Status ${response.status}`);

            const text = await response.text();
            if (text.trim().startsWith('<')) throw new Error('Formato inválido.');

            return JSON.parse(text);
        } catch (err) {
            console.warn(`Erro no endpoint ${endpoint}:`, err);
        }
    }

    throw new Error('Não foi possível carregar pontos de interesse (Serviço instável).');
};

/**
 * Classifica um POI e retorna ícone + classe CSS
 */
export const classifyPOI = (element) => {
    const type =
        element.tags.amenity ||
        element.tags.shop ||
        element.tags.leisure ||
        element.tags.aeroway;
    const name = element.tags.name || 'Local sem nome';
    let iconHtml = '📍';
    let className = 'poi-marker';

    if (element.tags.amenity === 'pharmacy') {
        iconHtml = '💊';
        className += ' poi-pharmacy';
    } else if (element.tags.shop === 'mall' || element.tags.amenity === 'marketplace') {
        iconHtml = '🛍️';
        className += ' poi-shopping';
    } else if (element.tags.shop === 'supermarket') {
        iconHtml = '🛒';
        className += ' poi-market';
    } else if (
        element.tags.amenity === 'school' ||
        element.tags.amenity === 'university'
    ) {
        iconHtml = '🎓';
        className += ' poi-school';
    } else if (element.tags.amenity === 'hospital') {
        iconHtml = '🏥';
        className += ' poi-hospital';
    } else if (element.tags.leisure === 'park') {
        iconHtml = '🌳';
        className += ' poi-park';
    } else if (element.tags.aeroway === 'aerodrome') {
        iconHtml = '✈️';
        className += ' poi-airport';
    }

    return { type, name, iconHtml, className };
};
