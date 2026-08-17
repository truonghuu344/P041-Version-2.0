# MinerU OCR

## Integration decision

CV and JD uploads already converge at `extract_text_from_document()` after file-signature and malware checks. MinerU is integrated at that boundary, so both upload flows receive the same cleaned Markdown text and continue through the existing parser, evidence guardrails, storage and matching pipeline unchanged.

The implementation uses MinerU's Agent file API: request a signed upload URL, upload the original document, poll the task, then download its Markdown output. It supports PDF, DOCX, JPG, JPEG and PNG. Tables are enabled and formula recognition is disabled because it adds cost without helping the CV/JD domain.

## Configuration

The checked-in template defaults to local Tesseract:

```env
OCR_PROVIDER=tesseract
```

This project instance is configured with `OCR_PROVIDER=mineru` and Vietnamese recognition (`MINERU_LANGUAGE=vi`). Paste the Console token into `MINERU_API_TOKEN` to use the authenticated Precision v4 API with the `vlm` model; if it is blank, the integration uses the public Agent API. Restart the backend after changing environment values.

## Operational and privacy notes

- MinerU receives the complete source CV/JD through its signed upload endpoint. Do not enable it if the document's consent or data-processing policy prohibits third-party processing.
- The public Agent API does not require a token but is rate-limited by IP. It returns Markdown only and has service limits; the integration rejects files larger than `MINERU_MAX_FILE_SIZE_MB` (default 10 MB) before upload.
- MinerU runs asynchronously. The backend waits up to `MINERU_POLL_TIMEOUT_SECONDS` (default 120) and returns `OCR_002` to the existing API error handler on service, rate-limit or timeout errors.
- This adapter targets MinerU's hosted Agent API contract. A fully private deployment needs either an Agent-compatible gateway or a small adapter for self-hosted `mineru-api` (`/file_parse` has a different contract).

## Sources

- [MinerU Agent API documentation](https://mineru.net/doc/docs/index_en/)
- [MinerU local API quick usage](https://opendatalab.github.io/MinerU/usage/quick_usage/)
