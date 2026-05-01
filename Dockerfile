FROM debian:bookworm-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
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
