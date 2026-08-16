from io import BytesIO
from types import SimpleNamespace

import pytest

from src.services import object_storage


def _r2_settings(**overrides):
    values = {
        "storage_provider": "r2",
        "s3_endpoint_url": "https://account.r2.cloudflarestorage.com",
        "s3_bucket": "private-cvs",
        "s3_region": "auto",
        "s3_access_key_id": "key",
        "s3_secret_access_key": "secret",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_local_storage_writes_and_deletes_only_inside_its_root(tmp_path, monkeypatch):
    monkeypatch.setattr(object_storage, "get_settings", lambda: SimpleNamespace(storage_provider="local"))
    stored = object_storage.put_bytes(
        content=b"cv content",
        key="ignored-local",
        content_type="application/pdf",
        local_path=tmp_path / "nested" / "resume.pdf",
    )

    assert object_storage.get_bytes(stored) == b"cv content"
    object_storage.delete(stored, local_root=tmp_path)
    assert not (tmp_path / "nested" / "resume.pdf").exists()


def test_r2_storage_uses_private_s3_operations(monkeypatch, tmp_path):
    calls = []

    class FakeClient:
        def put_object(self, **kwargs):
            calls.append(("put", kwargs))

        def get_object(self, **kwargs):
            calls.append(("get", kwargs))
            return {"Body": BytesIO(b"from r2")}

        def delete_object(self, **kwargs):
            calls.append(("delete", kwargs))

    monkeypatch.setattr(object_storage, "get_settings", lambda: _r2_settings())
    monkeypatch.setattr(object_storage, "_r2_client", lambda: FakeClient())
    uri = object_storage.put_bytes(
        content=b"upload",
        key="cvs/user-1/file.pdf",
        content_type="application/pdf",
        local_path=tmp_path / "must-not-be-created.pdf",
    )

    assert uri == "r2://private-cvs/cvs/user-1/file.pdf"
    assert not (tmp_path / "must-not-be-created.pdf").exists()
    assert object_storage.get_bytes(uri) == b"from r2"
    object_storage.delete(uri)
    assert calls == [
        ("put", {"Bucket": "private-cvs", "Key": "cvs/user-1/file.pdf", "Body": b"upload", "ContentType": "application/pdf"}),
        ("get", {"Bucket": "private-cvs", "Key": "cvs/user-1/file.pdf"}),
        ("delete", {"Bucket": "private-cvs", "Key": "cvs/user-1/file.pdf"}),
    ]


def test_r2_rejects_object_from_another_bucket(monkeypatch):
    monkeypatch.setattr(object_storage, "get_settings", lambda: _r2_settings())

    with pytest.raises(object_storage.ObjectStorageError, match="bucket"):
        object_storage.get_bytes("r2://another-bucket/cvs/user-1/file.pdf")
