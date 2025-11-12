# Multi-stage build for API
FROM rust:latest as api-builder

WORKDIR /app

# Set RISC Zero dev mode to skip toolchain installation
ENV RISC0_DEV_MODE=1

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY api/Cargo.toml ./api/
COPY methods/Cargo.toml ./methods/
COPY methods/guest/Cargo.toml ./methods/guest/

# Build dependencies first (caching layer)
RUN mkdir -p api/src methods/src methods/guest/src && \
    echo "fn main() {}" > api/src/main.rs && \
    echo "pub fn dummy() {}" > methods/src/lib.rs && \
    echo "fn main() {}" > methods/guest/src/main.rs && \
    cargo build --release || true && \
    rm -rf api/src methods/src methods/guest/src

# Copy actual source
COPY api ./api
COPY methods ./methods
COPY host ./host

# Build API
RUN cargo build --release -p api

# Build worker
RUN cargo build --release --bin worker

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=api-builder /app/target/release/api /app/api
COPY --from=api-builder /app/target/release/worker /app/worker
COPY --from=api-builder /app/api/migrations /app/migrations

EXPOSE 3000

CMD ["./api"]



