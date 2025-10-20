#!/bin/bash
# --- À CONFIGURER ---
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source ${SCRIPT_DIR}/.env
DB_USER="${POSTGRES_USER}"
DB_NAME="${POSTGRES_DB}"
CONTAINER_NAME="${CONTAINER_NAME}-db"

# Création d'un nom de fichier unique avec la date et l'heure
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="${DB_NAME}_${DATE}.dump"
FULL_PATH="${BACKUP_DIR}/${FILENAME}"

# Lancement de la commande de sauvegarde via docker exec
# On utilise le format "custom" (-Fc) qui est compressé et plus flexible pour la restauration
echo "Lancement de la sauvegarde de la base de données '${DB_NAME}'..."
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -F c > "${FULL_PATH}"

# Vérification du succès
if [ $? -eq 0 ]; then
  echo "Sauvegarde réussie : ${FULL_PATH}"
else
  echo "ERREUR : La sauvegarde de la base de données a échoué."
  # Optionnel : supprimer le fichier potentiellement corrompu
  rm -f "${FULL_PATH}"
fi
