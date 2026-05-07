# 🔑 Setup License enowxai di Dokploy

Panduan setup license/API key untuk enowxai di container Dokploy.

## ⚠️ Problem: 502 Bad Gateway

Jika kamu dapat error 502, kemungkinan besar enowxai belum di-setup dengan license/API key.

Log menunjukkan:
```
WARN heartbeat failed error="missing authorization header"
```

## 🔧 Solution: Setup License

### Option 1: Setup via Container Exec (Recommended)

1. **Di Dokploy Dashboard:**
   - Pilih service `enowxai-proxy`
   - Klik "Terminal" atau "Console"

2. **Atau via SSH ke server:**
```bash
docker exec -it enowxai-proxy sh
```

3. **Run enowxai setup:**
```bash
enowxai
```

4. **Follow prompts:**
   - Input license key atau API key
   - Setup akan save config ke `/root/.enowxai/config.json`

5. **Restart container:**
```bash
# Exit dari container
exit

# Restart via Dokploy dashboard atau:
docker restart enowxai-proxy
```

### Option 2: Setup via Environment Variable

Jika kamu punya API key, tambahkan di Dokploy Dashboard → Environment:

```
ENOWXAI_API_KEY=enx-your-api-key-here
```

Atau tambahkan di [`docker-compose.yml`](docker-compose.yml):

```yaml
environment:
  - TZ=UTC
  - ENOWXAI_HOST=0.0.0.0
  - HOST=0.0.0.0
  - BIND_ADDRESS=0.0.0.0
  - ENOWXAI_API_KEY=enx-your-api-key-here
```

### Option 3: Mount Config dari Local (Advanced)

Jika kamu sudah punya config enowxai di local:

1. **Copy config ke server:**
```bash
# Di local
scp -r ~/.enowxai user@server:/path/to/project/data/
```

2. **Update docker-compose.yml:**
```yaml
volumes:
  - ./data:/root/.enowxai
```

3. **Redeploy**

## ✅ Verifikasi Setup

Setelah setup, cek logs:

```bash
docker logs enowxai-proxy
```

**Harusnya tidak ada error:**
```
✅ INFO enowxai daemon started proxy_port=1430 dashboard_port=1431
✅ INFO Proxy server starting addr=0.0.0.0:1430
✅ INFO Dashboard server starting port=1431
```

**Tidak ada lagi:**
```
❌ WARN heartbeat failed error="missing authorization header"
```

## 🌐 Test Akses

Setelah license setup:

```bash
# Test dashboard
curl -I https://dashboard.fahrenal.dev

# Test API
curl https://ai.fahrenal.dev/v1/models
```

Harusnya tidak 502 lagi!

## 📝 Cara Dapat API Key

1. **Daftar di enowxlabs:**
   - Visit: https://enowxlabs.com
   - Sign up / Login
   - Generate API key

2. **Atau via CLI:**
```bash
enowxai login
# Follow prompts
```

## 🔄 Persistent Config

Config enowxai disimpan di Docker volume `enowxai-data`, jadi tidak hilang saat restart/redeploy.

Volume definition di [`docker-compose.yml`](docker-compose.yml):

```yaml
volumes:
  enowxai-data:
    driver: local
```

## 🐛 Troubleshooting

### License tidak persist setelah restart

Pastikan volume mounted dengan benar:

```bash
docker volume ls | grep enowxai
docker volume inspect enowxlabs-app-xxx_enowxai-data
```

### Masih 502 setelah setup

1. Cek logs: `docker logs enowxai-proxy`
2. Cek healthcheck: `docker ps` (status healthy?)
3. Cek Traefik logs: `docker logs traefik`
4. Restart container: `docker restart enowxai-proxy enowxai-shim`

---

**Next:** Setelah license setup, domain akan langsung accessible!
