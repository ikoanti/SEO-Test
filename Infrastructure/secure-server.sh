#!/bin/bash
# =============================================================================
# Server Security Hardening Script
# Usage: ./secure-server.sh
# This app is intended to run behind Docker/Caddy, so only SSH/HTTP/HTTPS
# should be publicly reachable.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}✗ Please run as root${NC}"
    exit 1
fi

echo -e "${CYAN}${BOLD}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SERVER SECURITY HARDENING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"

echo -e "\n${BOLD}▶ Step 1: Updating system packages${NC}"
echo "──────────────────────────────────────────────────────────────────────────────"
apt update && apt upgrade -y
echo -e "${GREEN}✓ System updated${NC}"

echo -e "\n${BOLD}▶ Step 2: Configuring SSH security${NC}"
echo "──────────────────────────────────────────────────────────────────────────────"

SSHD_CONFIG="/etc/ssh/sshd_config"
SSHD_RUNTIME_DIR="/run/sshd"

if [ ! -f "${SSHD_CONFIG}.backup" ]; then
    cp "$SSHD_CONFIG" "${SSHD_CONFIG}.backup"
    echo -e "${CYAN}ℹ Backed up original sshd_config${NC}"
fi

set_ssh_option() {
    local option="$1"
    local value="$2"
    sed -i "/^#*${option}/d" "$SSHD_CONFIG"
    echo "${option} ${value}" >> "$SSHD_CONFIG"
}

set_ssh_option "PermitRootLogin" "prohibit-password"
set_ssh_option "PasswordAuthentication" "no"
set_ssh_option "PubkeyAuthentication" "yes"
set_ssh_option "ChallengeResponseAuthentication" "no"
set_ssh_option "UsePAM" "yes"
set_ssh_option "X11Forwarding" "no"
set_ssh_option "MaxAuthTries" "3"
set_ssh_option "ClientAliveInterval" "300"
set_ssh_option "ClientAliveCountMax" "2"

mkdir -p "$SSHD_RUNTIME_DIR"
chmod 0755 "$SSHD_RUNTIME_DIR"

if sshd -t -f "$SSHD_CONFIG"; then
    echo -e "${GREEN}✓ SSH config valid${NC}"
    systemctl restart ssh
    echo -e "${GREEN}✓ SSH service restarted${NC}"
else
    echo -e "${RED}✗ SSH config invalid; restoring backup${NC}"
    cp "${SSHD_CONFIG}.backup" "$SSHD_CONFIG"
    exit 1
fi

echo -e "${GREEN}✓ SSH hardened${NC}"

echo -e "\n${BOLD}▶ Step 3: Installing Fail2ban${NC}"
echo "──────────────────────────────────────────────────────────────────────────────"

if apt install -y fail2ban; then
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
banaction = ufw

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h
EOF

    systemctl enable fail2ban
    systemctl restart fail2ban
    echo -e "${GREEN}✓ Fail2ban installed${NC}"
else
    echo -e "${YELLOW}⚠ Fail2ban could not be installed from apt on this host; continuing without it${NC}"
fi

echo -e "\n${BOLD}▶ Step 4: Configuring UFW firewall${NC}"
echo "──────────────────────────────────────────────────────────────────────────────"

apt install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

ufw deny 3000/tcp comment 'Block public app port'

ufw --force enable
echo -e "${GREEN}✓ UFW firewall enabled${NC}"

echo -e "\n${BOLD}▶ Step 5: Enabling automatic security updates${NC}"
echo "──────────────────────────────────────────────────────────────────────────────"

apt install -y unattended-upgrades

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

systemctl enable unattended-upgrades
systemctl restart unattended-upgrades
echo -e "${GREEN}✓ Automatic security updates enabled${NC}"

echo -e "\n${CYAN}${BOLD}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECURITY HARDENING COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"

echo -e "${BOLD}Summary:${NC}"
echo "  ✓ SSH hardened (key-only, no passwords)"
if command -v fail2ban-client >/dev/null 2>&1; then
    echo "  ✓ Fail2ban protecting SSH"
else
    echo "  ✓ Fail2ban skipped (package unavailable on this host)"
fi
echo "  ✓ UFW allows only 22, 80, and 443 publicly"
echo "  ✓ App port 3000 blocked from public access"
echo "  ✓ Automatic security updates enabled"
echo ""

echo -e "${CYAN}Firewall Status:${NC}"
ufw status numbered

echo ""
echo -e "${YELLOW}⚠ IMPORTANT: Test SSH in a NEW terminal before closing this session${NC}"
echo -e "${YELLOW}⚠ IMPORTANT: Keep the Node app behind Caddy instead of exposing port 3000 directly${NC}"
