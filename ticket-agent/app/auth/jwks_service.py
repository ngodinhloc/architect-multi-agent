import base64
import hashlib
from cryptography.hazmat.primitives.serialization import (
    load_pem_private_key,
    Encoding,
    PublicFormat,
)
from app.configs.settings import settings


class JwksService:
    def __init__(self) -> None:
        pem = settings.private_key_pem.replace("\\n", "\n").encode()
        private_key = load_pem_private_key(pem, password=None)
        public_key = private_key.public_key()
        pub_numbers = public_key.public_numbers()
        der = public_key.public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
        kid = hashlib.sha256(der).hexdigest()[:16]
        self._jwks = {
            "keys": [
                {
                    "kty": "RSA",
                    "use": "sig",
                    "alg": "RS256",
                    "kid": kid,
                    "n": self._b64url_int(pub_numbers.n),
                    "e": self._b64url_int(pub_numbers.e),
                }
            ]
        }

    def get_jwks(self) -> dict:
        return self._jwks

    @staticmethod
    def _b64url_int(n: int) -> str:
        length = (n.bit_length() + 7) // 8
        return base64.urlsafe_b64encode(n.to_bytes(length, "big")).rstrip(b"=").decode()


jwks_service = JwksService()
