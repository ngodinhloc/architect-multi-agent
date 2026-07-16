export interface JwkKey {
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}

export interface AuthUser {
  username: string;
  email: string;
  name: string;
}
