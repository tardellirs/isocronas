"""
Backend FastAPI para consulta de setores censitários IBGE.
Lê o GeoPackage via SQLite + R-tree + Shapely para interseção espacial.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from shapely.geometry import shape, mapping

from gpkg_utils import GPKG_PATH, ATTR_COLUMNS, ALL_COLUMNS, parse_gpkg_geom, get_db_connection
from models import IsochroneRequest


# --- App FastAPI ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not GPKG_PATH.exists():
        print(f"⚠️  ERRO: GeoPackage não encontrado em {GPKG_PATH}")
        print("   Baixe o arquivo do IBGE e coloque em malha/BR_setores_CD2022.gpkg")
    else:
        print(f"✅ GeoPackage encontrado: {GPKG_PATH} ({GPKG_PATH.stat().st_size / 1e9:.1f} GB)")
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM BR_setores_CD2022")
        count = cursor.fetchone()[0]
        print(f"✅ Total de setores censitários: {count:,}")
        conn.close()
    yield


app = FastAPI(title="API Setores Censitários IBGE", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/setores-isocrona")
async def get_setores_isocrona(request: IsochroneRequest):
    """
    Retorna os setores censitários do município que intersectam a isócrona.
    
    Estratégia de performance:
    1. Filtra por CD_MUN (reduz de 472k → ~85-1.500 setores)
    2. Usa R-tree para pré-filtro por bounding box
    3. Interseção fina com Shapely nos candidatos
    4. Só inclui setores com >= 50% de área coberta
    """
    try:
        iso_geom = shape(request.isochrone_geojson)
        if not iso_geom.is_valid:
            iso_geom = iso_geom.buffer(0)
        minx, miny, maxx, maxy = iso_geom.bounds
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GeoJSON inválido: {str(e)}")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cols_sql = ", ".join(f"s.{c}" for c in ALL_COLUMNS)

        query = f"""
            SELECT {cols_sql}
            FROM BR_setores_CD2022 s
            INNER JOIN rtree_BR_setores_CD2022_geom r ON s.id = r.id
            WHERE s.CD_MUN = ?
              AND r.minx <= ? AND r.maxx >= ?
              AND r.miny <= ? AND r.maxy >= ?
        """

        cursor.execute(query, (request.cd_mun, maxx, minx, maxy, miny))
        rows = cursor.fetchall()

        features = []
        total_pop = 0
        total_dom = 0

        for row in rows:
            row_id = row[0]
            geom_blob = row[1]
            attrs = row[2:]

            sector_geom = parse_gpkg_geom(geom_blob)
            if sector_geom is None:
                continue

            if not sector_geom.is_valid:
                sector_geom = sector_geom.buffer(0)

            if not iso_geom.intersects(sector_geom):
                continue

            # Calcular % de cobertura
            try:
                intersection = iso_geom.intersection(sector_geom)
                sector_area = sector_geom.area
                pct_cobertura = (intersection.area / sector_area) if sector_area > 0 else 0.0
            except Exception:
                pct_cobertura = 0.0

            # Filtro: mínimo 50% da área
            if pct_cobertura < 0.5:
                continue

            attr_dict = dict(zip(ATTR_COLUMNS, attrs))
            attr_dict["pct_cobertura"] = round(pct_cobertura * 100, 1)

            simplified = sector_geom.simplify(0.0001, preserve_topology=True)

            feature = {
                "type": "Feature",
                "geometry": mapping(simplified),
                "properties": attr_dict,
            }
            features.append(feature)

            if attr_dict.get("v0001"):
                total_pop += attr_dict["v0001"]
            if attr_dict.get("v0002"):
                total_dom += attr_dict["v0002"]

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
        raise HTTPException(status_code=500, detail=f"Erro na consulta: {str(e)}")
    finally:
        conn.close()


@app.get("/api/health")
async def health():
    """Health check."""
    exists = GPKG_PATH.exists()
    return {
        "status": "ok" if exists else "error",
        "gpkg_exists": exists,
        "gpkg_path": str(GPKG_PATH),
    }


# Em produção, serve o build do Vite
dist_path = Path(__file__).parent.parent / "dist"
if dist_path.exists():
    app.mount("/", StaticFiles(directory=str(dist_path), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando servidor em http://localhost:8000")
    print("📍 Frontend (dev): npm run dev → http://localhost:5173")
    print("📍 Frontend (prod): http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
