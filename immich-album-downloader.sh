#!/bin/bash

# Default Image
IMAGE="ghcr.io/zckyachmd/immich-album-downloader:latest"

# Use --help, on empty arguments
if [ $# -eq 0 ]; then
    ARGS="--help"
else
    ARGS="$@"
fi

# Docker run mit .env und Volume
docker run --rm \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  $IMAGE $ARGS
