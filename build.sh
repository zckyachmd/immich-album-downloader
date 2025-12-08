#!/bin/bash
set -euo pipefail

# Usage: ./build.sh [DOCKERFILE] [IMAGEAPPEND]
# This script builds Docker image once and tags it with multiple tags

DOCKERFILE=${1:-Dockerfile}
IMAGEAPPEND=${2:-}

# Set variables if they are not already defined (useful for local execution)
: "${GITHUB_REF:=refs/heads/$(git symbolic-ref --short HEAD 2>/dev/null || echo 'unknown')}"
: "${GITHUB_REPOSITORY:=$(git config --get remote.origin.url 2>/dev/null | sed 's/.*github.com.//;s/.git$//' || echo 'unknown/unknown')}"
: "${GITHUB_SHA:=$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"

COMMIT_HASH=$(echo "$GITHUB_SHA" | cut -c1-12)
IMAGE_NAME="ghcr.io/${GITHUB_REPOSITORY}${IMAGEAPPEND}"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")

# Determine the channel based on the branch
CHANNEL=""
if [[ "$GITHUB_REF" == "refs/heads/main" ]] || [[ "$GITHUB_REF" == "refs/heads/master" ]]; then
  CHANNEL="latest"
elif [[ "$GITHUB_REF" == "refs/heads/develop" ]]; then
  CHANNEL="develop"
fi

echo "=========================================="
echo "Building Docker Image"
echo "=========================================="
echo "Image Name: ${IMAGE_NAME}"
echo "Version: ${VERSION}"
echo "Commit: ${COMMIT_HASH}"
echo "Branch: ${GITHUB_REF}"
echo "Channel: ${CHANNEL:-none}"
echo "=========================================="

# Build image once with commit hash as primary tag
PRIMARY_TAG="${COMMIT_HASH}"
echo "Building image with tag: ${PRIMARY_TAG}"
docker build \
  --file "${DOCKERFILE}" \
  --tag "${IMAGE_NAME}:${PRIMARY_TAG}" \
  --tag "${IMAGE_NAME}:${COMMIT_HASH}" \
  .

# Array to collect all tags for pushing
TAGS=("${PRIMARY_TAG}" "${COMMIT_HASH}")

# Add version tag
if [[ "$VERSION" != "unknown" ]]; then
  echo "Tagging with version: v${VERSION}"
  docker tag "${IMAGE_NAME}:${PRIMARY_TAG}" "${IMAGE_NAME}:v${VERSION}"
  docker tag "${IMAGE_NAME}:${PRIMARY_TAG}" "${IMAGE_NAME}:${VERSION}"
  TAGS+=("v${VERSION}" "${VERSION}")
fi

# Add channel tag (latest or develop)
if [[ -n "$CHANNEL" ]]; then
  echo "Tagging with channel: ${CHANNEL}"
  docker tag "${IMAGE_NAME}:${PRIMARY_TAG}" "${IMAGE_NAME}:${CHANNEL}"
  TAGS+=("${CHANNEL}")
fi

# Push all tags only in CI environment
if [[ "${CI:-false}" == "true" ]]; then
  echo "=========================================="
  echo "Pushing Docker Images"
  echo "=========================================="
  for TAG in "${TAGS[@]}"; do
    echo "Pushing ${IMAGE_NAME}:${TAG}"
    docker push "${IMAGE_NAME}:${TAG}"
  done
  echo "=========================================="
  echo "All images pushed successfully!"
  echo "=========================================="
else
  echo "=========================================="
  echo "Local build complete. Images not pushed."
  echo "To push manually, run: docker push ${IMAGE_NAME}:<tag>"
  echo "=========================================="
fi
