/**
 * Exporta setores censitários como CSV
 */
export const downloadCensusCSV = (censusSectors) => {
    if (!censusSectors || !censusSectors.features?.length) return;

    const headers = [
        'CD_SETOR', 'NM_BAIRRO', 'SITUACAO', 'CD_TIPO', 'AREA_KM2',
        'v0001', 'v0002', 'v0003', 'v0004', 'v0005', 'v0006', 'v0007',
        'pct_cobertura',
    ];
    const csvRows = [headers.join(';')];

    censusSectors.features.forEach((f) => {
        const p = f.properties;
        const row = headers.map((h) => {
            const val = p[h];
            if (val === null || val === undefined) return '';
            return String(val).replace(/;/g, ',');
        });
        csvRows.push(row.join(';'));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `setores_censitarios_${censusSectors.summary?.municipio || 'export'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
};
