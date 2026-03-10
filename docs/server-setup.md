# 🖥️ Setup do Servidor — Oracle Ampere (ARM64)

Guia de configuração inicial da instância para rodar o **M2G2 Isócronas** via Docker.

**IP:** `132.226.247.169`  
**Domínio:** `iso.imob.dev` → DNS A record na Cloudflare

---

## 1. Acesso à instância

```bash
ssh ubuntu@132.226.247.169
# ou: ssh opc@132.226.247.169 (dependendo da imagem escolhida)
```

---

## 2. Instalar Docker e Docker Compose

```bash
# Atualiza o sistema
sudo apt update && sudo apt upgrade -y

# Instala dependências
sudo apt install -y ca-certificates curl gnupg

# Adiciona repositório oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Adiciona usuário ao grupo docker (sem precisar de sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verifica instalação
docker --version
docker compose version
```

---

## 3. Liberar portas no firewall da Oracle

### 3a. Firewall do Linux (iptables)

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT

# Persiste entre reboots
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

### 3b. Security List da Oracle Cloud

No painel da Oracle ([console.oracle.com](https://console.oracle.com)):
1. Acesse: **Networking → Virtual Cloud Networks → sua VCN → Security Lists**
2. Adicione duas **Ingress Rules**:
   - Protocolo: `TCP` | Source: `0.0.0.0/0` | Destination Port: `80`
   - Protocolo: `TCP` | Source: `0.0.0.0/0` | Destination Port: `443`

---

## 4. Clonar o repositório

```bash
git clone https://github.com/tardellirs/isocronas.git ~/isocronas
cd ~/isocronas
```

---

## 5. Gerar certificado SSL (Cloudflare Origin CA)

> O DNS já está apontando para a instância com proxy da Cloudflare. Precisamos de um **Origin CA** para a comunicação Cloudflare ↔ servidor.

1. Acesse **Cloudflare Dashboard → seu domínio imob.dev → SSL/TLS**
2. Mude o modo para **Full (Strict)**
3. Vá em **SSL/TLS → Origin Server → Create Certificate**
4. Mantenha as configurações padrão (RSA 2048, 15 anos)
5. Clique em **Create**
6. Copie os dois valores gerados:
   - **Certificate** → salve como `origin.crt`
   - **Private Key** → salve como `origin.key`

Na instância:
```bash
mkdir -p ~/isocronas/nginx/certs

# Cole o conteúdo de cada arquivo:
nano ~/isocronas/nginx/certs/origin.crt
nano ~/isocronas/nginx/certs/origin.key

# Ajusta permissões
chmod 600 ~/isocronas/nginx/certs/origin.key
chmod 644 ~/isocronas/nginx/certs/origin.crt
```

---

## 6. Upload do GeoPackage IBGE (~1.5 GB)

Execute **na sua máquina local**:
```bash
# Cria o diretório na instância e faz o upload
ssh ubuntu@132.226.247.169 "mkdir -p ~/isocronas/malha"

rsync -avz --progress \
  /caminho/local/para/BR_setores_CD2022.gpkg \
  ubuntu@132.226.247.169:~/isocronas/malha/BR_setores_CD2022.gpkg
```

---

## 7. Configurar variáveis de ambiente

```bash
cd ~/isocronas
cp .env.example .env
nano .env
```

Preencha com suas chaves:
```env
VITE_ORS_API_KEY=sua_chave_openrouteservice
VITE_GEMINI_API_KEY=sua_chave_gemini
```

---

## 8. Primeiro deploy

```bash
cd ~/isocronas

# Build e start
docker compose build
docker compose up -d

# Verifica se está rodando
docker compose ps
docker compose logs -f app
```

Acesse **https://iso.imob.dev** — deve estar funcionando! 🎉

---

## 9. Configurar CI/CD — Chaves SSH para GitHub Actions

### 9a. Gerar par de chaves na instância

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 9b. Adicionar secrets no GitHub

Acesse: **GitHub → seu repositório → Settings → Secrets and variables → Actions**

| Secret | Valor |
|--------|-------|
| `SSH_HOST` | `132.226.247.169` |
| `SSH_USER` | `ubuntu` (ou o usuário da sua instância) |
| `SSH_PRIVATE_KEY` | Conteúdo de `~/.ssh/github_actions` (chave **privada**) |

Cole a chave privada:
```bash
cat ~/.ssh/github_actions  # Copie todo o conteúdo
```

A partir de agora, todo `git push` para a branch `main` fará deploy automático!

---

## Comandos úteis no servidor

```bash
# Ver status dos containers
docker compose ps

# Acompanhar logs em tempo real
docker compose logs -f

# Reiniciar a aplicação
docker compose restart app

# Parar tudo
docker compose down

# Deploy manual (mesmo comportamento do CI/CD)
bash ~/isocronas/scripts/deploy.sh

# Ver uso de disco
df -h
docker system df
```
