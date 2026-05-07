# Deployment Guide untuk Dokploy

Panduan lengkap deploy enowxai proxy stack di Dokploy dengan domain `fahrenal.dev`.

## 🎯 Hasil Akhir

Setelah deployment berhasil, kamu akan punya:

- **API Endpoint**: `https://ai.fahrenal.dev` (enowxai-shim proxy)
- **Dashboard**: `https://dashboard.fahrenal.dev` (enowxai dashboard)

## 📋 Prerequisites

1. ✅ Dokploy sudah terinstall dan running
2. ✅ Domain `fahrenal.dev` sudah pointing ke server Dokploy
3. ✅ Traefik sudah dikonfigurasi di Dokploy (biasanya otomatis)
4. ✅ SSL certificate resolver `letsencrypt` sudah aktif di Traefik

## 🚀 Langkah Deployment

### 1. Setup di Dokploy Dashboard

1. **Buat Project Baru**
   - Login ke Dokploy dashboard
   - Klik "Create Project"
   - Nama: `enowxai-proxy` (atau sesuai keinginan)

2. **Tambah Service Compose**
   - Di dalam project, klik "Add Service"
   - Pilih "Docker Compose"
   - Nama service: `enowxai-stack`

3. **Connect Repository**
   - Pilih repository GitHub/GitLab kamu
   - Branch: `main` atau branch yang kamu gunakan
   - Dokploy akan otomatis detect `docker-compose.yml`

### 2. Konfigurasi DNS

Pastikan DNS records sudah dikonfigurasi:

```
Type: A
Host: ai
Value: [IP Server Dokploy]
TTL: Auto

Type: A
Host: dashboard
Value: [IP Server Dokploy]
TTL: Auto
```

Atau gunakan wildcard:

```
Type: A
Host: *
Value: [IP Server Dokploy]
TTL: Auto
```

### 3. Deploy

1. Klik tombol **"Deploy"** di Dokploy
2. Dokploy akan:
   - Clone repository
   - Build kedua Docker images (`enowxai` dan `enowxai-shim`)
   - Start containers
   - Traefik akan otomatis generate SSL certificates
   - Route traffic ke domain yang benar

### 4. Monitoring

Cek status deployment:

```bash
# Di server Dokploy, cek logs
docker compose logs -f enowxai
docker compose logs -f enowxai-shim

# Cek container status
docker compose ps
```

Di Dokploy dashboard, kamu bisa lihat:
- Build logs
- Container status
- Resource usage

## 🔍 Verifikasi Deployment

### Test API Endpoint

```bash
# Test models endpoint
curl https://ai.fahrenal.dev/v1/models

# Dengan API key
curl -H "Authorization: Bearer enx-your-api-key" \
  https://ai.fahrenal.dev/v1/models
```

### Test Dashboard

Buka browser dan akses:
```
https://dashboard.fahrenal.dev
```

### Test dari OpenCode

Update OpenCode config (`~/.config/opencode/config.json`):

```json
{
  "provider": {
    "enowxlabs": {
      "options": {
        "baseURL": "https://ai.fahrenal.dev/v1",
        "apiKey": "enx-your-api-key-here"
      }
    }
  }
}
```

## 📊 Arsitektur

```
Internet
  │
  ├─→ dashboard.fahrenal.dev (HTTPS)
  │     │
  │     └─→ Traefik (Dokploy)
  │           │
  │           └─→ enowxai:1431 (Dashboard)
  │
  └─→ ai.fahrenal.dev (HTTPS)
        │
        └─→ Traefik (Dokploy)
              │
              └─→ enowxai-shim:1432
                    │
                    └─→ enowxai:1430 (API)
```

## 🔧 Konfigurasi Penting

### Traefik Labels

File [`docker-compose.yml`](docker-compose.yml) sudah dikonfigurasi dengan:

**Dashboard Service:**
- Router: `enowxai-dashboard`
- Domain: `dashboard.fahrenal.dev`
- Port: `1431`
- SSL: Auto (Let's Encrypt)

**API Service (Shim):**
- Router: `enowxai-api`
- Domain: `ai.fahrenal.dev`
- Port: `1432`
- SSL: Auto (Let's Encrypt)

### Healthchecks

Kedua service punya healthcheck:

**enowxai:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:1430/v1/models"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**enowxai-shim:**
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:1432/v1/models"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 20s
```

### Networks

- `enowxai-network`: Internal network untuk komunikasi antar container
- `dokploy-network`: External network untuk Traefik routing (otomatis dibuat Dokploy)

## 🐛 Troubleshooting

### 1. Domain tidak bisa diakses

**Cek DNS:**
```bash
nslookup ai.fahrenal.dev
nslookup dashboard.fahrenal.dev
```

**Cek Traefik routing:**
```bash
# Di server Dokploy
docker logs traefik 2>&1 | grep fahrenal
```

### 2. SSL Certificate Error

Tunggu beberapa menit untuk Let's Encrypt generate certificate. Cek logs:

```bash
docker logs traefik 2>&1 | grep letsencrypt
```

### 3. Container tidak healthy

```bash
# Cek healthcheck status
docker compose ps

# Cek logs detail
docker compose logs enowxai
docker compose logs enowxai-shim
```

### 4. 502 Bad Gateway

Kemungkinan:
- Container belum ready (tunggu healthcheck pass)
- Port mapping salah (cek labels di docker-compose.yml)
- Network issue (cek `dokploy-network` exists)

```bash
# Cek network
docker network ls | grep dokploy

# Restart services
docker compose restart
```

### 5. API Key Invalid

Ambil API key dari enowxai:

```bash
# Exec ke container
docker exec -it enowxai-proxy sh

# Cek config
cat /root/.enowxai/config.json
```

Atau akses dashboard di `https://dashboard.fahrenal.dev` untuk lihat/generate API key.

## 🔄 Update Deployment

Untuk update code:

1. Push changes ke repository
2. Di Dokploy dashboard, klik "Redeploy"
3. Atau set auto-deploy on push (webhook)

Untuk rebuild dari scratch:

```bash
# Di Dokploy, pilih "Rebuild"
# Atau manual di server:
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 📝 Environment Variables

Jika perlu custom environment variables, tambahkan di Dokploy dashboard:

- `TZ`: Timezone (default: UTC)
- `SHIM_MAX_RETRIES`: Max retry untuk tool calls (default: 2)
- `ENOWXAI_UPSTREAM`: Upstream URL (default: http://enowxai:1430/v1)

## 🎉 Selesai!

Setelah semua langkah di atas, kamu punya:

✅ API endpoint di `https://ai.fahrenal.dev/v1`
✅ Dashboard di `https://dashboard.fahrenal.dev`
✅ SSL certificates otomatis
✅ Auto-restart on failure
✅ Healthcheck monitoring
✅ Zero-downtime updates via Dokploy

## 📚 Referensi

- [README.md](README.md) - Dokumentasi lengkap project
- [docker-compose.yml](docker-compose.yml) - Konfigurasi services
- Dokploy docs: https://docs.dokploy.com
- Traefik docs: https://doc.traefik.io/traefik/
