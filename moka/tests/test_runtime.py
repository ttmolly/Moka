from moka.runtime import PROVIDER_ALIASES, available_providers, resolve_providers


def test_cpu_provider_is_always_resolvable():
    providers = available_providers()
    assert "CPUExecutionProvider" in providers
    assert resolve_providers("cpu") == ["CPUExecutionProvider"]
    assert resolve_providers("auto") == ["CPUExecutionProvider"]


def test_tensorrt_is_never_implicit():
    assert resolve_providers("auto") == ["CPUExecutionProvider"]
    assert "tensorrt" in PROVIDER_ALIASES
