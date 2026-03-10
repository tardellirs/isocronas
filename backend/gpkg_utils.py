"""
Utilitários para leitura dos GeoPackages IBGE (Setores, Bairros e Subdistritos).
"""

import sqlite3
from pathlib import Path

from shapely import wkb

# Caminhos dos GeoPackages
GPKG_PATH = Path(__file__).parent.parent / "malha" / "BR_setores_CD2022.gpkg"
BAIRRO_GPKG_PATH = Path(__file__).parent.parent / "malha" / "BR_bairros_CD2022.gpkg"
SUBDIST_GPKG_PATH = Path(__file__).parent.parent / "malha" / "BR_subdistritos_CD2022.gpkg"

# ── Setores Censitários ──────────────────────────────────────────
ATTR_COLUMNS = [
    "CD_SETOR", "SITUACAO", "CD_SIT", "CD_TIPO", "AREA_KM2",
    "CD_MUN", "NM_MUN",
    "CD_DIST", "NM_DIST",
    "CD_SUBDIST", "NM_SUBDIST",
    "CD_BAIRRO", "NM_BAIRRO",
    "CD_NU", "NM_NU",
    "CD_AGLOM", "NM_AGLOM",
    "CD_RGINT", "NM_RGINT",
    "CD_RGI", "NM_RGI",
    "CD_CONCURB", "NM_CONCURB",
    "v0001", "v0002", "v0003", "v0004", "v0005", "v0006", "v0007",
]

ALL_COLUMNS = ["id", "geom"] + ATTR_COLUMNS

# ── Bairros ──────────────────────────────────────────────────────
BAIRRO_ATTR_COLUMNS = [
    "CD_BAIRRO", "NM_BAIRRO", "CD_MUN", "NM_MUN",
    "CD_DIST", "NM_DIST", "AREA_KM2",
    "v0001", "v0002", "v0003", "v0004", "v0005", "v0006", "v0007",
]

BAIRRO_ALL_COLUMNS = ["id", "geom"] + BAIRRO_ATTR_COLUMNS

# ── Subdistritos ──────────────────────────────────────────────────
SUBDIST_ATTR_COLUMNS = [
    "CD_SUBDIST", "NM_SUBDIST", "CD_MUN", "NM_MUN",
    "CD_DIST", "NM_DIST", "AREA_KM2",
    "v0001", "v0002", "v0003", "v0004", "v0005", "v0006", "v0007",
]

SUBDIST_ALL_COLUMNS = ["id", "geom"] + SUBDIST_ATTR_COLUMNS


def parse_gpkg_geom(blob: bytes):
    """
    Parse GeoPackage geometry binary to Shapely geometry.
    O formato GPKG é: magic(2) + version(1) + flags(1) + srs_id(4) + [envelope] + WKB.
    """
    if blob is None:
        return None

    # Magic number "GP"
    if blob[0:2] != b"GP":
        try:
            return wkb.loads(blob)
        except Exception:
            return None

    flags = blob[3]
    envelope_type = (flags >> 1) & 0x07

    envelope_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
    envelope_size = envelope_sizes.get(envelope_type, 0)

    wkb_offset = 8 + envelope_size
    wkb_data = blob[wkb_offset:]

    try:
        return wkb.loads(wkb_data)
    except Exception:
        return None


def _make_connection(path: Path):
    """Retorna uma conexão SQLite otimizada ao GeoPackage."""
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA cache_size = -50000")  # 50MB cache
    conn.execute("PRAGMA mmap_size = 268435456")  # 256MB mmap
    return conn


def get_db_connection():
    """Conexão ao GeoPackage de setores censitários."""
    return _make_connection(GPKG_PATH)


def get_bairro_db_connection():
    """Conexão ao GeoPackage de bairros."""
    return _make_connection(BAIRRO_GPKG_PATH)


def get_subdist_db_connection():
    """Conexão ao GeoPackage de subdistritos."""
    return _make_connection(SUBDIST_GPKG_PATH)
