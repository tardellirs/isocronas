"""
Modelos Pydantic para a API.
"""

from pydantic import BaseModel


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
