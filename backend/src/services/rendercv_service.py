"""RenderCV validation and PDF rendering inside the Career Assistant backend."""

import pathlib
import tempfile
from dataclasses import dataclass
from typing import Any

from rendercv.renderer.pdf_png import generate_pdf
from rendercv.renderer.typst import generate_typst
from rendercv.schema.models.design.built_in_design import (
    available_themes,
    built_in_design_adapter,
)
from rendercv.schema.rendercv_model_builder import build_rendercv_dictionary_and_model

MAX_DOCUMENT_BYTES = 512 * 1024


@dataclass(slots=True)
class RenderCVDocuments:
    """The CV document plus the optional RenderCV overlay documents."""

    cv_yaml: str
    design_yaml: str = ""
    locale_yaml: str = ""
    settings_yaml: str = ""

    def validate_sizes(self) -> None:
        """Reject oversized YAML documents before parsing or rendering."""
        for field_name, value in (
            ("cv_yaml", self.cv_yaml),
            ("design_yaml", self.design_yaml),
            ("locale_yaml", self.locale_yaml),
            ("settings_yaml", self.settings_yaml),
        ):
            if len(value.encode("utf-8")) > MAX_DOCUMENT_BYTES:
                raise ValueError(
                    f"`{field_name}` exceeds the {MAX_DOCUMENT_BYTES} byte limit."
                )


def blank_to_none(value: str) -> str | None:
    """Translate an empty overlay tab to the absence expected by RenderCV."""
    return value if value.strip() else None


def validate_rendercv_documents(documents: RenderCVDocuments) -> None:
    """Validate YAML through RenderCV's native schema pipeline."""
    documents.validate_sizes()
    build_rendercv_dictionary_and_model(
        documents.cv_yaml,
        design_yaml_file=blank_to_none(documents.design_yaml),
        locale_yaml_file=blank_to_none(documents.locale_yaml),
        settings_yaml_file=blank_to_none(documents.settings_yaml),
    )


def render_rendercv_pdf(documents: RenderCVDocuments) -> bytes:
    """Compile validated RenderCV YAML to PDF bytes in an isolated directory."""
    documents.validate_sizes()
    with tempfile.TemporaryDirectory(prefix="career-rendercv-") as temp_dir:
        input_file_path = pathlib.Path(temp_dir) / "cv.yaml"
        _, model = build_rendercv_dictionary_and_model(
            documents.cv_yaml,
            design_yaml_file=blank_to_none(documents.design_yaml),
            locale_yaml_file=blank_to_none(documents.locale_yaml),
            settings_yaml_file=blank_to_none(documents.settings_yaml),
            input_file_path=input_file_path,
            dont_generate_markdown=True,
            dont_generate_html=True,
            dont_generate_png=True,
        )
        typst_path = generate_typst(model)
        pdf_path = generate_pdf(model, typst_path)
        if pdf_path is None:
            raise ValueError("RenderCV settings disabled Typst or PDF generation.")
        return pdf_path.read_bytes()


def list_rendercv_themes() -> list[dict[str, Any]]:
    """Return theme names and defaults from the vendored RenderCV registry."""
    themes: list[dict[str, Any]] = []
    for theme_name in available_themes:
        design = built_in_design_adapter.validate_python({"theme": theme_name})
        themes.append(
            {
                "name": theme_name,
                # Some vendored themes normalize ``font_family`` from a string
                # into a per-role mapping.  The resulting JSON is valid, but
                # Pydantic warns because the discriminated union still retains
                # the original string branch in its serializer metadata.
                "design_defaults": design.model_dump(mode="json", warnings=False),
            }
        )
    return themes
