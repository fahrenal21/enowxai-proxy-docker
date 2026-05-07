# 🚀 Quick Start - Dokploy Deployment

Panduan singkat deploy ke Dokploy dengan domain `fahrenal.dev`.

## ✅ Checklist Pre-Deployment

- [ ] DNS records sudah pointing ke server Dokploy:
  - `ai.fahrenal.dev` → IP Server
  - `dashboard.fahrenal.dev` → IP Server
- [ ] Dokploy sudah running
- [ ] Repository sudah di-push ke GitHub/GitLab

## 📝 Langkah Deploy (5 Menit)

### 1. Di Dokploy Dashboard

```
1. Create Project → Nama: "enowxai-proxy"
2. Add Service → Docker Compose → Nama: "enowxai-stack"
3. Connect Repository → Pilih repo & branch
4. Klik "Deploy"
```

### 2. Tunggu Build Selesai

Dokploy akan:
- ✅ Build 2 Docker images (~3-5 menit)
- ✅ Start containers
- ✅ Generate SSL certificates
- ✅ Route traffic

### 3. Verifikasi

```bash
# Test API
curl https://ai.fahrenal.dev/v1/models

# Test Dashboard
# Buka browser: https://dashboard.fahrenal.dev
```

## 🎯 Hasil Akhir

- **API**: `https://ai.fahrenal.dev/v1`
- **Dashboard**: `https://dashboard.fahrenal.dev`

## 🔧 Konfigurasi OpenCode

Update `~/.config/opencode/config.json`:

```json
{
  "provider": {
    "enowxlabs": {
      "options": {
        "baseURL": "https://ai.fahrenal.dev/v1",
        "apiKey": "enx-your-api-key"
      }
    }
  }
}
```

API key bisa diambil dari dashboard: `https://dashboard.fahrenal.dev`

## 🐛 Troubleshooting Cepat

| Problem | Solution |
|---------|----------|
| Domain tidak bisa diakses | Cek DNS: `nslookup ai.fahrenal.dev` |
| 502 Bad Gateway | Tunggu healthcheck pass (~40 detik) |
| SSL Error | Tunggu Let's Encrypt (~2 menit) |
| Container error | Cek logs di Dokploy dashboard |

## 📚 Dokumentasi Lengkap

Lihat [`DOKPLOY-DEPLOYMENT.md`](DOKPLOY-DEPLOYMENT.md) untuk:
- Troubleshooting detail
- Arsitektur sistem
- Update & maintenance
- Environment variables

---

**Need help?** Cek logs di Dokploy dashboard atau jalankan:
```bash
docker compose logs -f
```
