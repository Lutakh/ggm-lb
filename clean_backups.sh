#!/bin/bash

# --- À CONFIGURER ---
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source ${SCRIPT_DIR}/.env
RETENTION_DAYS=31
# --------------------

echo "Recherche des sauvegardes de plus de ${RETENTION_DAYS} jours dans ${BACKUP_DIR}..."

# La commande find recherche les fichiers (-type f) modifiés il y a plus de X jours (-mtime +X)
# et les supprime (-delete). On cible uniquement les fichiers .dump par sécurité.
find "${BACKUP_DIR}" -type f -mtime +${RETENTION_DAYS} -name "*.dump" -print -delete

echo "Nettoyage terminé."