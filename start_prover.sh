#!/usr/bin/env bash

# start_prover.sh
# Starts the Midnight proof server in a detached Docker container bound to port 6300.
# If you would like to stop it later, run: `docker stop midnight-proof-server`.

set -euo pipefail

CONTAINER_NAME="midnight-proof-server"
IMAGE="midnightnetwork/proof-server"
EXPOSE_PORT="6300"
NETWORK="testnet"

# Check if the container is already running
if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
  echo "A container named '${CONTAINER_NAME}' is already running."
  exit 0
fi

# If an exited container exists, remove it
if [ "$(docker ps -aq -f status=exited -f name=${CONTAINER_NAME})" ]; then
  docker rm "${CONTAINER_NAME}" > /dev/null
fi

# Run the container in detached mode
exec docker run -d --name "${CONTAINER_NAME}" -p "${EXPOSE_PORT}:${EXPOSE_PORT}" "${IMAGE}" -- "midnight-proof-server --network ${NETWORK}" 