# Accès à Distance Sécurisé via Cloudflare Tunnel (`cloudflared`)

Ce guide explique comment configurer l'accès à distance sécurisé à **EL-AMEL LAB** depuis un smartphone ou un ordinateur personnel, sans ouvrir de port sur votre routeur/box internet et sans adresse IP publique fixe.

---

## 1. Principe de Fonctionnement

```text
  ┌─────────────────────────────────────────────────────────┐
  │                 PC du Laboratoire (Clinique)            │
  │                                                         │
  │   [Application Bureau Tauri] (Minimisée dans la barre)  │
  │            │                                            │
  │            ▼                                            │
  │   [Backend FastAPI & SQLite] (127.0.0.1:8000)           │
  │            ▲                                            │
  │            │                                            │
  │   [Service cloudflared] ─────────────────┐              │
  └──────────────────────────────────────────┼──────────────┘
                                             │ Tunnel Chiffré Sortant
                                             ▼ (Port 443 / HTTPS)
                                ┌─────────────────────────┐
                                │     Réseau Cloudflare   │
                                │   (rh.elamel-lab.dz)    │
                                │    + Code OTP par email │
                                └────────────┬────────────┘
                                             │
                                ┌────────────▼────────────┐
                                │  Smartphone du Médecin  │
                                │  (Navigateur Web Mobile)│
                                └─────────────────────────┘
```

1. **Aucun port entrant ouvert :** `cloudflared` établit une connexion chiffrée *sortante* vers le réseau Cloudflare. Votre pare-feu et votre box internet restent 100% fermés.
2. **Fonctionnement Continu (Tray Keep-Alive) :** Lorsque vous fermez la fenêtre de l'application sur le PC du laboratoire, celle-ci se réduit dans la barre des tâches (icône près de l'horloge). Le serveur reste actif pour votre téléphone.
3. **Sécurité Double Barrière (Cloudflare Zero Trust) :** Avant même d'atteindre l'écran de connexion de l'application, Cloudflare demande votre adresse email et vous envoie un code PIN à 6 chiffres à usage unique (2FA réseau gratuit).

---

## 2. Option Rapide : "Quick Tunnel" (Test Immédiat)

Idéal pour tester l'accès depuis votre téléphone en 1 minute sans posséder de nom de domaine :

1. Installez `cloudflared` :
   * **Arch Linux / Omarchy :** `sudo pacman -S cloudflared`
   * **Windows :** `winget install --id Cloudflare.cloudflared`
   * **Debian / Ubuntu :** `sudo apt install cloudflared`
2. Lancez le script :
   ```bash
   ./scripts/setup-tunnel.sh
   # Choisissez l'option 1
   ```
3. Une URL temporaire sécurisée (ex: `https://elamel-lab-demo.trycloudflare.com`) s'affiche dans le terminal.
4. Ouvrez cette URL sur votre smartphone et connectez-vous avec vos identifiants administrateur.

---

## 3. Option Définitive : "Named Tunnel" avec Nom de Domaine & Zero Trust

Pour une utilisation permanente (ex: `https://rh.votre-labo.com` ou `https://rh.elamel-lab.dz`) :

### Étape 1 : Créer le Tunnel sur Cloudflare One
1. Créez un compte gratuit sur [dash.cloudflare.com](https://dash.cloudflare.com/) et ajoutez votre nom de domaine.
2. Rendez-vous dans **Zero Trust** > **Networks** > **Tunnels** > **Create a tunnel**.
3. Nommez le tunnel (ex: `el-amel-lab-pc`).
4. Sélectionnez le système d'exploitation du PC (Windows ou Linux) et copiez la commande d'installation contenant le jeton (`--token eyJh...`).

### Étape 2 : Configurer le Service Local
1. Dans l'onglet **Public Hostname** du tunnel Cloudflare :
   * **Subdomain :** `rh`
   * **Domain :** `elamel-lab.dz` (votre domaine)
   * **Type :** `HTTP`
   * **URL :** `127.0.0.1:8000`
2. Cliquez sur **Save Tunnel**.

### Étape 3 : Installer en Service Démarrage Automatique
Pour que le tunnel démarre même si personne n'est connecté au PC :
* **Linux :**
  ```bash
  sudo cloudflared service install <votre-token>
  sudo systemctl enable --now cloudflared
  ```
* **Windows :** Exécutez l'invite de commandes en tant qu'administrateur :
  ```cmd
  cloudflared.exe service install <votre-token>
  ```

---

## 4. Activer l'Authentification Zero Trust (PIN 2FA)

Pour bloquer tout accès non autorisé à votre URL :

1. Dans **Zero Trust** > **Access** > **Applications** > **Add an application** > **Self-hosted**.
2. Nommez-la `EL-AMEL LAB Mobile`.
3. Entrez l'URL : `rh.elamel-lab.dz`.
4. Ajoutez une règle de politique (**Policy**) :
   * **Action :** `Allow`
   * **Include :** `Emails` -> Entrez votre email personnel (ex: `directeur@elamel-lab.dz`).
5. Enregistrez. Désormais, toute tentative de connexion depuis l'extérieur exigera la validation par code PIN envoyé par email avant d'accéder au portail.
