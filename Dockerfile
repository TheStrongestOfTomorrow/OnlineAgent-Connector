# =============================================================================
#  online-agent Docker image
# -----------------------------------------------------------------------------
#  Runs online-agent in a container so users can use it WITHOUT a PAT
#  (Docker Hub / GHCR are public, no auth needed to pull).
#
#  Usage:
#    docker run -it --rm \
#      -p 7777:7777 \
#      -v "$PWD:/workspace" \
#      thestrongestoftomorrow/online-agent:latest
#
#  Then point your AI agent at:
#    ws://127.0.0.1:7777/        (from the host)
#    ws://<host-ip>:7777/        (from another machine on the LAN)
#
#  Build:
#    docker build -t thestrongestoftomorrow/online-agent:latest .
#
#  The container starts in TUI mode by default. To run headless:
#    docker run -d --rm \
#      -p 7777:7777 \
#      -v "$PWD:/workspace" \
#      thestrongestoftomorrow/online-agent:latest \
#      start --lan
# =============================================================================

FROM node:20-slim

# Install shells + common tools so shell.exec has something to call
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash \
      git \
      curl \
      ca-certificates \
      less \
      procps \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user so the agent doesn't run as root inside the container
RUN useradd --create-home --shell /bin/bash oa

# Set up the working directory (mounted from host at runtime)
RUN mkdir -p /workspace && chown -R oa:oa /workspace
WORKDIR /workspace

# Copy the package and install it globally
COPY --chown=oa:oa package.json package-lock.json* /app/
COPY --chown=oa:oa bin/ /app/bin/
COPY --chown=oa:oa src/ /app/src/
COPY --chown=oa:oa examples/ /app/examples/
COPY --chown=oa:oa README.md LICENSE CHANGELOG.md /app/

USER oa
WORKDIR /app
RUN npm install --omit=dev --no-fund --no-audit && npm link

# Back to /workspace so the agent is sandboxed there
WORKDIR /workspace

# Expose the default port
EXPOSE 7777

# Default: launch the TUI (needs -it for interactive terminal)
CMD ["online-agent"]
