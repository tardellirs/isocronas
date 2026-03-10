"""
Backend FastAPI para consulta de setores censitários, bairros e subdistritos IBGE.
Lê o GeoPackage via SQLite + R-tree + Shapely para interseção espacial.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from shapely.geometry import shape, mapping

from gpkg_utils import (
    GPKG_PATH, BAIRRO_GPKG_PATH, SUBDIST_GPKG_PATH,
    ATTR_COLUMNS, ALL_COLUMNS,
    BAIRRO_ATTR_COLUMNS, BAIRRO_ALL_COLUMNS,
    SUBDIST_ATTR_COLUMNS, SUBDIST_ALL_COLUMNS,
    parse_gpkg_geom, get_db_connection, get_bairro_db_connection,
    get_subdist_db_connection,
)
from models import IsochroneRequest


# --- App FastAPI ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    for label, path, table in [
        ("Setores", GPKG_PATH, "BR_setores_CD2022"),
        ("Bairros", BAIRRO_GPKG_PATH, "BR_bairros_CD2022"),
        ("Subdistritos", SUBDIST_GPKG_PATH, "BR_subdistritos_CD2022"),
    ]:
        if not path.exists():
            print(f"⚠️  {label}: GeoPackage não encontrado em {path}")
        else:
            print(f"✅ {label}: {path} ({path.stat().st_size / 1e9:.1f} GB)")
    yield


app = FastAPI(title="API Setores Censitários, Bairros & Subdistritos IBGE", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _intersect_features(conn, table_name, all_columns, attr_columns, iso_geom, cd_mun, min_coverage=0.5):
    """
    Lógica genérica de interseção espacial para setores ou bairros.
    Retorna (features, total_pop, total_dom).
    """
    minx, miny, maxx, maxy = iso_geom.bounds
    cursor = conn.cursor()

    cols_sql = ", ".join(f"s.{c}" for c in all_columns)
    query = f"""
        SELECT {cols_sql}
        FROM {table_name} s
        INNER JOIN rtree_{table_name}_geom r ON s.id = r.id
        WHERE s.CD_MUN = ?
          AND r.minx <= ? AND r.maxx >= ?
          AND r.miny <= ? AND r.maxy >= ?
    """
    cursor.execute(query, (cd_mun, maxx, minx, maxy, miny))
    rows = cursor.fetchall()

    features = []
    total_pop = 0
    total_dom = 0

    for row in rows:
        geom_blob = row[1]
        attrs = row[2:]

        geom = parse_gpkg_geom(geom_blob)
        if geom is None:
            continue

        if not geom.is_valid:
            geom = geom.buffer(0)

        if not iso_geom.intersects(geom):
            continue

        try:
            intersection = iso_geom.intersection(geom)
            area = geom.area
            pct = (intersection.area / area) if area > 0 else 0.0
        except Exception:
            pct = 0.0

        if pct < min_coverage:
            continue

        attr_dict = dict(zip(attr_columns, attrs))
        attr_dict["pct_cobertura"] = round(pct * 100, 1)

        # Converter v0001-v0007 para int/float
        for k in ["v0001", "v0002", "v0003", "v0007"]:
            if attr_dict.get(k) is not None:
                try:
                    attr_dict[k] = int(attr_dict[k])
                except (ValueError, TypeError):
                    attr_dict[k] = 0
        for k in ["v0004", "v0005", "v0006"]:
            if attr_dict.get(k) is not None:
                try:
                    attr_dict[k] = float(attr_dict[k])
                except (ValueError, TypeError):
                    attr_dict[k] = 0.0

        simplified = geom.simplify(0.0001, preserve_topology=True)

        feature = {
            "type": "Feature",
            "geometry": mapping(simplified),
            "properties": attr_dict,
        }
        features.append(feature)

        total_pop += attr_dict.get("v0001", 0) or 0
        total_dom += attr_dict.get("v0002", 0) or 0

    return features, total_pop, total_dom


@app.post("/api/setores-isocrona")
async def get_setores_isocrona(request: IsochroneRequest):
    """Retorna setores censitários que intersectam a isócrona (>= 50% cobertura)."""
    try:
        iso_geom = shape(request.isochrone_geojson)
        if not iso_geom.is_valid:
            iso_geom = iso_geom.buffer(0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GeoJSON inválido: {str(e)}")

    conn = get_db_connection()
    try:
        features, total_pop, total_dom = _intersect_features(
            conn, "BR_setores_CD2022", ALL_COLUMNS, ATTR_COLUMNS,
            iso_geom, request.cd_mun,
        )
        return {
            "type": "FeatureCollection",
            "features": features,
            "summary": {
                "total_setores": len(features),
                "total_populacao": total_pop,
                "total_domicilios": total_dom,
                "municipio": request.cd_mun,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")
    finally:
        conn.close()


@app.post("/api/bairros-isocrona")
async def get_bairros_isocrona(request: IsochroneRequest):
    """
    Retorna bairros que intersectam a isócrona.
    - Geometria: do GeoPackage de bairros
    - Dados censitários: agregados dos setores por CD_BAIRRO (mais precisos)
    """
    try:
        iso_geom = shape(request.isochrone_geojson)
        if not iso_geom.is_valid:
            iso_geom = iso_geom.buffer(0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GeoJSON inválido: {str(e)}")

    # 1. Buscar geometrias dos bairros
    bairro_conn = get_bairro_db_connection()
    try:
        bairro_features, _, _ = _intersect_features(
            bairro_conn, "BR_bairros_CD2022", BAIRRO_ALL_COLUMNS, BAIRRO_ATTR_COLUMNS,
            iso_geom, request.cd_mun, min_coverage=0.3,  # threshold menor para bairros (áreas maiores)
        )
    finally:
        bairro_conn.close()

    # 2. Agregar dados dos setores por CD_BAIRRO
    setor_conn = get_db_connection()
    try:
        setor_features, _, _ = _intersect_features(
            setor_conn, "BR_setores_CD2022", ALL_COLUMNS, ATTR_COLUMNS,
            iso_geom, request.cd_mun,
        )
    finally:
        setor_conn.close()

    # Agregar setores por CD_BAIRRO
    bairro_data = {}
    for sf in setor_features:
        p = sf["properties"]
        cd = p.get("CD_BAIRRO", "")
        if not cd:
            continue
        if cd not in bairro_data:
            bairro_data[cd] = {
                "v0001": 0, "v0002": 0, "v0003": 0, "v0007": 0,
                "setores_count": 0,
            }
        bd = bairro_data[cd]
        bd["v0001"] += p.get("v0001", 0) or 0
        bd["v0002"] += p.get("v0002", 0) or 0
        bd["v0003"] += p.get("v0003", 0) or 0
        bd["v0007"] += p.get("v0007", 0) or 0
        bd["setores_count"] += 1

    # 3. Enriquecer features dos bairros com dados agregados
    total_pop = 0
    total_dom = 0
    enriched_features = []

    for bf in bairro_features:
        cd = bf["properties"].get("CD_BAIRRO", "")
        agg = bairro_data.get(cd, {})

        bf["properties"]["v0001_agg"] = agg.get("v0001", 0)
        bf["properties"]["v0002_agg"] = agg.get("v0002", 0)
        bf["properties"]["v0003_agg"] = agg.get("v0003", 0)
        bf["properties"]["v0007_agg"] = agg.get("v0007", 0)
        bf["properties"]["setores_count"] = agg.get("setores_count", 0)

        total_pop += agg.get("v0001", 0)
        total_dom += agg.get("v0002", 0)
        enriched_features.append(bf)

    return {
        "type": "FeatureCollection",
        "features": enriched_features,
        "summary": {
            "total_bairros": len(enriched_features),
            "total_populacao": total_pop,
            "total_domicilios": total_dom,
            "municipio": request.cd_mun,
        },
    }


@app.post("/api/subdistritos-isocrona")
async def get_subdistritos_isocrona(request: IsochroneRequest):
    """
    Retorna subdistritos que intersectam a isócrona (>= 50% cobertura).
    - Geometria: do GeoPackage de subdistritos
    - Dados censitários: agregados dos setores por CD_SUBDIST (mais precisos)
    """
    try:
        iso_geom = shape(request.isochrone_geojson)
        if not iso_geom.is_valid:
            iso_geom = iso_geom.buffer(0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GeoJSON inválido: {str(e)}")

    subdist_conn = get_subdist_db_connection()
    try:
        subdist_features, _, _ = _intersect_features(
            subdist_conn, "BR_subdistritos_CD2022",
            SUBDIST_ALL_COLUMNS, SUBDIST_ATTR_COLUMNS,
            iso_geom, request.cd_mun, min_coverage=0.5,
        )
    finally:
        subdist_conn.close()

    setor_conn = get_db_connection()
    try:
        setor_features, _, _ = _intersect_features(
            setor_conn, "BR_setores_CD2022", ALL_COLUMNS, ATTR_COLUMNS,
            iso_geom, request.cd_mun,
        )
    finally:
        setor_conn.close()

    subdist_data = {}
    for sf in setor_features:
        p = sf["properties"]
        cd = p.get("CD_SUBDIST", "")
        if not cd:
            continue
        if cd not in subdist_data:
            subdist_data[cd] = {
                "v0001": 0, "v0002": 0, "v0003": 0, "v0007": 0,
                "setores_count": 0,
            }
        sd = subdist_data[cd]
        sd["v0001"] += p.get("v0001", 0) or 0
        sd["v0002"] += p.get("v0002", 0) or 0
        sd["v0003"] += p.get("v0003", 0) or 0
        sd["v0007"] += p.get("v0007", 0) or 0
        sd["setores_count"] += 1

    total_pop = 0
    total_dom = 0
    enriched_features = []

    for sf in subdist_features:
        cd = sf["properties"].get("CD_SUBDIST", "")
        agg = subdist_data.get(cd, {})

        sf["properties"]["v0001_agg"] = agg.get("v0001", 0)
        sf["properties"]["v0002_agg"] = agg.get("v0002", 0)
        sf["properties"]["v0003_agg"] = agg.get("v0003", 0)
        sf["properties"]["v0007_agg"] = agg.get("v0007", 0)
        sf["properties"]["setores_count"] = agg.get("setores_count", 0)

        total_pop += agg.get("v0001", 0)
        total_dom += agg.get("v0002", 0)
        enriched_features.append(sf)

    return {
        "type": "FeatureCollection",
        "features": enriched_features,
        "summary": {
            "total_subdistritos": len(enriched_features),
            "total_populacao": total_pop,
            "total_domicilios": total_dom,
            "municipio": request.cd_mun,
        },
    }


@app.get("/api/health")
async def health():
    """Health check."""
    setores_ok = GPKG_PATH.exists()
    bairros_ok = BAIRRO_GPKG_PATH.exists()
    subdist_ok = SUBDIST_GPKG_PATH.exists()
    return {
        "status": "ok" if setores_ok else "error",
        "gpkg_setores": setores_ok,
        "gpkg_bairros": bairros_ok,
        "gpkg_subdistritos": subdist_ok,
    }


# Em produção, serve o build do Vite
dist_path = Path(__file__).parent.parent / "dist"
if dist_path.exists():
    app.mount("/", StaticFiles(directory=str(dist_path), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando servidor em http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
