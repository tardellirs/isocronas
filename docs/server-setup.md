# 🖥️ Setup do Servidor — Oracle Ampere (ARM64)

Guia de configuração da instância para rodar o **M2G2 Isócronas** via Docker.

**IP:** `132.226.247.169` | **Domínio:** `iso.imob.dev` (Cloudflare)

---

## Como funciona o SSL

```
Usuário → HTTPS → Cloudflare (SSL público) → HTTP → Nginx → FastAPI
```

> O SSL é gerenciado pela **Cloudflare** (nuvem laranja). O Nginx só precisa ouvir HTTP na porta 80 — nenhum certificado precisa ser instalado no servidor.

---

## 1. Configurar a Cloudflare (OBRIGATÓRIO primeiro)

Acesse o painel da Cloudflare → domínio `imob.dev` → **DNS**:

### 1a. Verificar o registro DNS
O registro A deve existir assim:

| Tipo | Nome | Conteúdo | Proxy |
|------|------|----------|-------|
| `A` | `iso` | `132.226.247.169` | ☁️ **Proxied** (nuvem **laranja**) |

> ⚠️ Se a nuvem estiver **cinza** (DNS only), o SSL não vai funcionar. Clique para torná-la **laranja**.

### 1b. Configurar o modo SSL
Acesse **SSL/TLS → Overview** e selecione:

**✅ Full** (ou Full Strict)

---

## 2. Liberar porta 80 na Oracle

### 2a. Firewall Linux (iptables)
```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

### 2b. Security List Oracle Cloud
[console.oracle.com](https://console.oracle.com) → **Networking → VCN → Security Lists**

Adicione uma **Ingress Rule**:
- Protocolo: `TCP` | Source: `0.0.0.0/0` | Destination Port: `80`

---

## 3. Instalar Docker

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

---

## 4. Clonar o repositório

```bash
git clone https://github.com/tardellirs/isocronas.git ~/isocronas
cd ~/isocronas
```

---

## 5. Upload do GeoPackage IBGE (~1.5 GB)

Execute **na sua máquina local**:

```bash
ssh ubuntu@132.226.247.169 "mkdir -p ~/isocronas/malha"

rsync -avz --progress \
  /caminho/local/para/BR_setores_CD2022.gpkg \
  ubuntu@132.226.247.169:~/isocronas/malha/BR_setores_CD2022.gpkg
```

---

## 6. Configurar variáveis de ambiente

```bash
cd ~/isocronas
cp .env.example .env
nano .env
```

```env
VITE_ORS_API_KEY=sua_chave_openrouteservice
VITE_GEMINI_API_KEY=sua_chave_gemini
```

---

## 7. Primeiro deploy

```bash
cd ~/isocronas
docker compose build
docker compose up -d

# Verificar
docker compose ps
docker compose logs -f app
```

Acesse **https://iso.imob.dev** — deve funcionar! 🎉

---

## 8. Configurar CI/CD (GitHub Actions)

### Gerar chave SSH na instância

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Adicionar secrets no GitHub

**GitHub → seu repositório → Settings → Secrets → Actions**

| Secret | Valor |
|--------|-------|
| `SSH_HOST` | `132.226.247.169` |
| `SSH_USER` | `ubuntu` (ou `opc`) |
| `SSH_PRIVATE_KEY` | conteúdo de `~/.ssh/github_actions` (chave privada) |

```bash
cat ~/.ssh/github_actions  # Copie tudo, incluindo BEGIN/END
```

---

## Comandos úteis

```bash
docker compose ps              # status dos containers
docker compose logs -f         # logs em tempo real
docker compose restart app     # reiniciar o app
bash ~/isocronas/scripts/deploy.sh  # deploy manual
```
