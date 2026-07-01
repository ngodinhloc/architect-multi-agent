import hashlib
import base64
import logging
import time
import jwt
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from app.configs.settings import settings

_JWT_EXPIRY_SECONDS = 300

logger = logging.getLogger("jwt_service")


class JwtService:
    def __init__(self) -> None:
        self._private_key = self._load_private_key()
        self._kid = self._key_id()

    def sign(self) -> str:
        now = int(time.time())
        exp = now + _JWT_EXPIRY_SECONDS
        payload = {
            "iss": settings.service_host,
            "aud": settings.mcp_server_url,
            "iat": now,
            "exp": exp,
        }
        token = jwt.encode(payload, self._private_key, algorithm="RS256", headers={"kid": self._kid})
        logger.info(
            "JwtService.sign: JWT signed",
            extra={"iss": settings.service_host, "aud": settings.mcp_server_url, "kid": self._kid, "exp": exp},
        )
        return token

    def get_jwks(self) -> dict:
        pub = self._private_key.public_key()
        numbers = pub.public_numbers()

        def _b64url(n: int) -> str:
            byte_len = (n.bit_length() + 7) // 8
            return base64.urlsafe_b64encode(n.to_bytes(byte_len, "big")).rstrip(b"=").decode()

        return {
            "keys": [
                {
                    "kty": "RSA",
                    "use": "sig",
                    "alg": "RS256",
                    "kid": self._kid,
                    "n": _b64url(numbers.n),
                    "e": _b64url(numbers.e),
                }
            ]
        }

    def _load_private_key(self) -> RSAPrivateKey:
        raw = settings.private_key_pem
        if not raw:
            raise ValueError("PRIVATE_KEY_PEM is not set. Generate a key with: openssl genrsa 2048")
        pem = (
            raw.replace("\\r\\n", "\n")
               .replace("\\r", "\n")
               .replace("\\n", "\n")
               .replace("\r\n", "\n")
               .replace("\r", "\n")
               .strip()
        )
        return load_pem_private_key(pem.encode(), password=None)

    def _key_id(self) -> str:
        pub_numbers = self._private_key.public_key().public_numbers()
        n_bytes = pub_numbers.n.to_bytes((pub_numbers.n.bit_length() + 7) // 8, "big")
        return hashlib.sha256(n_bytes).hexdigest()[:16]
