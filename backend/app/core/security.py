from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt  # type: ignore[import-untyped]

from app.core.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class RequestContext:
    user_id: UUID
    organization_id: UUID
    roles: tuple[str, ...]


def _uuid_claim(payload: dict, key: str, fallback: str) -> UUID:
    try:
        return UUID(str(payload.get(key) or fallback))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid {key}") from exc


def get_request_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    x_organization_id: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> RequestContext:
    """Use ARGO JWT claims when supplied, with a development-only local context otherwise."""
    if credentials:
        try:
            payload = jwt.decode(
                credentials.credentials,
                settings.argo_jwt_secret,
                algorithms=[settings.argo_jwt_algorithm],
                issuer=settings.argo_jwt_issuer,
                audience=settings.argo_jwt_audience,
                options={"verify_aud": bool(settings.argo_jwt_audience)},
            )
        except JWTError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ARGO token") from exc
        organization_id = _uuid_claim(payload, "organization_id", settings.argo_dev_organization_id)
        user_id = _uuid_claim(payload, "sub", settings.argo_dev_user_id)
        raw_roles = payload.get("roles", payload.get("role", settings.argo_dev_role))
        roles = tuple(raw_roles if isinstance(raw_roles, list) else [raw_roles])
        return RequestContext(user_id=user_id, organization_id=organization_id, roles=roles)

    if settings.app_env.lower() != "development":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ARGO bearer token is required")

    return RequestContext(
        user_id=UUID(settings.argo_dev_user_id),
        organization_id=UUID(x_organization_id or settings.argo_dev_organization_id),
        roles=(settings.argo_dev_role,),
    )


def require_roles(*allowed_roles: str):
    def dependency(context: RequestContext = Depends(get_request_context)) -> RequestContext:
        if not set(context.roles).intersection(allowed_roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return context

    return dependency
