from fastapi import APIRouter

from app.api.v1 import admin, auth, claims, items, layers, me, tickets

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(admin.router, prefix="/admin")
api_router.include_router(items.router, prefix="/items")
api_router.include_router(claims.router, prefix="/claims")
api_router.include_router(layers.router, prefix="/layers")
api_router.include_router(tickets.router, prefix="/tickets")
api_router.include_router(me.router, prefix="/me")