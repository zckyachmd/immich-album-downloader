#!/bin/bash

# Usage: ./build.sh [DOCKERFILE] [IMAGEAPPEND]

# Set variables
DOCKERFILE=${1:-Dockerfile}
IMAGEAPPEND=${2:-}

# Set variables if they are not already defined (useful for local execution)
: "${GITHUB_REF:=refs/heads/$(git symbolic-ref --short HEAD)}"
: "${GITHUB_REPOSITORY:=$(git config --get remote.origin.url | sed 's/.*github.com.//;s/.git$//')}"

COMMIT_HASH=$(git rev-parse HEAD)
CURRENT_DATE=$(date +'%Y%m%d')
CURRENT_DATE_WITH_HOUR=$(date +'%Y%m%d%H')
IMAGE_NAME="ghcr.io/${GITHUB_REPOSITORY}${IMAGEAPPEND}"

# Determine the channel based on the branch
CHANNEL=""
if [ "$GITHUB_REF" == "refs/heads/master" ] || [ "$GITHUB_REF" == "refs/heads/main" ]; then
  CHANNEL="latest"
elif [ "$GITHUB_REF" == "refs/heads/stable" ]; then
  CHANNEL="stable"
fi
echo "CHANNEL ${CHANNEL}"
echo "IMAGE_NAME ${IMAGE_NAME}"

# Function to push the Docker image
build_image() {
  TAG=$1
  docker build . --file ${DOCKERFILE} --tag ${IMAGE_NAME}:${TAG}
}

# Funktion zum Pushen des Docker-Images
push_image() {
  TAG=$1
  docker push ${IMAGE_NAME}:${TAG}
}

# Build for the stable branch
if [ "$CHANNEL" == "stable" ]; then
  build_image "${CHANNEL}-${CURRENT_DATE}"
  build_image "${CHANNEL}-${CURRENT_DATE_WITH_HOUR}"
fi

# Build for the commit hash
build_image "${COMMIT_HASH}"

# Build for the channel (if set)
if [ -n "$CHANNEL" ]; then
  build_image "${CHANNEL}"
fi

# Perform push operations only in CI environment (GitHub Actions)
if [ "$CI" == "true" ]; then
  if [ "$CHANNEL" == "stable" ]; then
    push_image "${CHANNEL}-${CURRENT_DATE}"
    push_image "${CHANNEL}-${CURRENT_DATE_WITH_HOUR}"
  fi

  push_image "${COMMIT_HASH}"

  if [ -n "$CHANNEL" ]; then
    push_image "${CHANNEL}"
  fi
else
  echo "Local execution detected — Docker images will not be pushed."
fi
