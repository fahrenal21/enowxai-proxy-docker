FROM node:20-alpine

WORKDIR /app

COPY shim.mjs ./shim.mjs

ENV SHIM_HOST=0.0.0.0
ENV SHIM_PORT=1432
ENV ENOWXAI_UPSTREAM=http://enowxai:1430/v1
ENV SHIM_MAX_RETRIES=2

EXPOSE 1432

CMD ["node", "/app/shim.mjs"]
