#!/bin/bash
if ! git diff-index --quiet HEAD --; then
    echo "There are uncommitted changes in the repository. Please commit your changes first."
    exit 1
fi

./build.sh Dockerfile
