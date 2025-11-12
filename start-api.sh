#!/bin/bash
cd api
export $(cat ../.env | xargs 2>/dev/null || true)
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/mpesa_credit}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export BIND_ADDRESS="0.0.0.0:8080"
cargo run --bin api
