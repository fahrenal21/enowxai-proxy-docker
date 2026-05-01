FROM debian:bookworm-slim

# Install dependencies including browser automation libraries
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    # Browser automation dependencies for Playwright/Camoufox
    libgtk-3-0 \
    libdbus-glib-1-2 \
    libxt6 \
    libpci3 \
    libasound2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    libnss3 \
    libcups2 \
    libxss1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Download and install enowxai binary
RUN curl -sSL https://api.enowxlabs.com/install/enowx-ai | sh

# Add binary to PATH
ENV PATH="/root/.local/bin:${PATH}"

# Expose enowxai daemon port
EXPOSE 1430

# Run enowxai daemon
CMD ["enowxai", "__daemon"]