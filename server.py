"""
Backend FastAPI para consulta de setores censitários IBGE.
Lê o GeoPackage via SQLite + R-tree + Shapely para interseção espacial.
"""

import json
import os
import sqlite3
import struct
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from shapely.geometry import shape, mapping
from shapely import wkb

# --- Configuração ---
GPKG_PATH = Path(__file__).parent / "malha" / "BR_setores_CD2022.gpkg"

# Colunas a retornar (sem geometria pesada desnecessária)
ATTR_COLUMNS = [
    "CD_SETOR", "SITUACAO", "CD_SIT", "CD_TIPO", "AREA_KM2",
    "CD_MUN", "NM_MUN", "CD_DIST", "NM_DIST",
    "CD_BAIRRO", "NM_BAIRRO",
    "v0001", "v0002", "v0003", "v0004", "v0005", "v0006", "v0007",
]

ALL_COLUMNS = ["id", "geom"] + ATTR_COLUMNS


# --- Helpers para ler geometria do GeoPackage (GeoPackage Binary / WKB) ---

def parse_gpkg_geom(blob: bytes):
    """
    Parse GeoPackage geometry binary to Shapely geometry.
    O formato GPKG é: magic(2) + version(1) + flags(1) + srs_id(4) + [envelope] + WKB.
    """
    if blob is None:
        return None

    # Magic number "GP"
    if blob[0:2] != b"GP":
        # Tenta interpretar como WKB puro
        try:
            return wkb.loads(blob)
        except Exception:
            return None

    flags = blob[3]
    envelope_type = (flags >> 1) & 0x07

    # Calcula tamanho do envelope
    envelope_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
    envelope_size = envelope_sizes.get(envelope_type, 0)

    # O WKB começa após: magic(2) + version(1) + flags(1) + srs_id(4) + envelope
    wkb_offset = 8 + envelope_size
    wkb_data = blob[wkb_offset:]

    try:
        return wkb.loads(wkb_data)
    except Exception:
        return None


def get_db_connection():
    """Retorna uma conexão SQLite ao GeoPackage."""
    conn = sqlite3.connect(str(GPKG_PATH))
    conn.execute("PRAGMA cache_size = -50000")  # 50MB cache
    conn.execute("PRAGMA mmap_size = 268435456")  # 256MB mmap
    return conn


# --- Modelos Pydantic ---

class IsochroneRequest(BaseModel):
    cd_mun: str
    isochrone_geojson: dict  # GeoJSON Polygon ou MultiPolygon


class SectorInfo(BaseModel):
    cd_setor: str
    situacao: str | None = None
    cd_sit: str | None = None
    cd_tipo: str | None = None
    area_km2: float | None = None
    cd_mun: str | None = None
    nm_mun: str | None = None
    cd_bairro: str | None = None
    nm_bairro: str | None = None
    v0001: int | None = None  # Total de pessoas
    v0002: int | None = None  # Total de domicílios
    v0003: int | None = None  # Domicílios particulares
    v0004: int | None = None  # Domicílios coletivos
    v0005: float | None = None  # Média moradores
    v0006: float | None = None  # % DPO imputados
    v0007: int | None = None  # DPO (DPPO + DPIO)


# --- App FastAPI ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Verifica se o GPKG existe na inicialização
    if not GPKG_PATH.exists():
        print(f"⚠️  ERRO: GeoPackage não encontrado em {GPKG_PATH}")
        print("   Baixe o arquivo do IBGE e coloque em malha/BR_setores_CD2022.gpkg")
    else:
        print(f"✅ GeoPackage encontrado: {GPKG_PATH} ({GPKG_PATH.stat().st_size / 1e9:.1f} GB)")
        # Testa conexão
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM BR_setores_CD2022")
        count = cursor.fetchone()[0]
        print(f"✅ Total de setores censitários: {count:,}")
        conn.close()
    yield


app = FastAPI(title="API Setores Censitários IBGE", lifespan=lifespan)

# CORS para permitir o frontend acessar
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
    """
    try:
        # Parse da geometria da isócrona
        iso_geom = shape(request.isochrone_geojson)
        if not iso_geom.is_valid:
            iso_geom = iso_geom.buffer(0)  # Fix geometria inválida

        # Bounding box da isócrona para R-tree
        minx, miny, maxx, maxy = iso_geom.bounds

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GeoJSON inválido: {str(e)}")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Query combinando filtro por município + R-tree spatial index
        # O R-tree filtra por bounding box, e depois testamos interseção real
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

        # Interseção fina com Shapely + filtro de 50% de área
        features = []
        total_pop = 0
        total_dom = 0

        for row in rows:
            row_id = row[0]
            geom_blob = row[1]
            attrs = row[2:]  # Resto das colunas

            # Parse geometria
            sector_geom = parse_gpkg_geom(geom_blob)
            if sector_geom is None:
                continue

            # Fix geometria inválida
            if not sector_geom.is_valid:
                sector_geom = sector_geom.buffer(0)

            # Teste de interseção real
            if not iso_geom.intersects(sector_geom):
                continue

            # Calcular % de cobertura: área da interseção / área do setor
            try:
                intersection = iso_geom.intersection(sector_geom)
                sector_area = sector_geom.area
                if sector_area > 0:
                    pct_cobertura = intersection.area / sector_area
                else:
                    pct_cobertura = 0.0
            except Exception:
                pct_cobertura = 0.0

            # Filtro: mínimo 50% da área do setor dentro da isócrona
            if pct_cobertura < 0.5:
                continue

            # Monta o dict de atributos
            attr_dict = dict(zip(ATTR_COLUMNS, attrs))
            attr_dict["pct_cobertura"] = round(pct_cobertura * 100, 1)

            # Simplifica geometria para reduzir payload (tolerância ~10m)
            simplified = sector_geom.simplify(0.0001, preserve_topology=True)

            feature = {
                "type": "Feature",
                "geometry": mapping(simplified),
                "properties": attr_dict,
            }
            features.append(feature)

            # Acumula totais
            if attr_dict.get("v0001"):
                total_pop += attr_dict["v0001"]
            if attr_dict.get("v0002"):
                total_dom += attr_dict["v0002"]

        result = {
            "type": "FeatureCollection",
            "features": features,
            "summary": {
                "total_setores": len(features),
                "total_populacao": total_pop,
                "total_domicilios": total_dom,
                "municipio": request.cd_mun,
            },
        }

        return result

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


# Serve arquivos estáticos (index.html) na raiz
app.mount("/", StaticFiles(directory=str(Path(__file__).parent), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando servidor em http://localhost:8000")
    print("📍 Frontend: http://localhost:8000/index.html")
    uvicorn.run(app, host="0.0.0.0", port=8000)
