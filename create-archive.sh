#!/bin/bash

# Script to create a clean archive of the codebase, respecting .gitignore
# Creates: csli-dashboard-archive.zip

set -e

PROJECT_NAME="csli-dashboard"
ARCHIVE_NAME="${PROJECT_NAME}-archive.zip"
TEMP_DIR=$(mktemp -d)

echo "Creating archive of ${PROJECT_NAME}..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "Error: This script must be run from the project root (git repository)"
    exit 1
fi

# Method 1: If there are no uncommitted changes, use git archive (cleanest)
if git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "Using git archive for clean working directory..."
    git archive --format=zip --output="${ARCHIVE_NAME}" HEAD
else
    echo "Working directory has changes. Creating archive with current files..."

    # Method 2: Use git ls-files to get tracked files and rsync to copy
    # This respects .gitignore and includes uncommitted changes

    # Create temporary directory structure
    mkdir -p "${TEMP_DIR}/${PROJECT_NAME}"

    # Get list of files that git tracks (respects .gitignore)
    git ls-files | while IFS= read -r file; do
        # Skip if file doesn't exist (deleted but not committed)
        [ ! -f "$file" ] && continue
        # Create directory structure in temp location
        dir=$(dirname "$file")
        [ "$dir" != "." ] && mkdir -p "${TEMP_DIR}/${PROJECT_NAME}/${dir}"
        # Copy file
        cp "$file" "${TEMP_DIR}/${PROJECT_NAME}/${file}"
    done

    # Also include untracked files that aren't ignored
    git ls-files --others --exclude-standard | while IFS= read -r file; do
        # Skip if file doesn't exist (shouldn't happen but be safe)
        [ ! -f "$file" ] && continue
        # Create directory structure in temp location
        dir=$(dirname "$file")
        [ "$dir" != "." ] && mkdir -p "${TEMP_DIR}/${PROJECT_NAME}/${dir}"
        # Copy file
        cp "$file" "${TEMP_DIR}/${PROJECT_NAME}/${file}"
    done

    # Create zip from temp directory
    cd "${TEMP_DIR}"
    zip -r "${OLDPWD}/${ARCHIVE_NAME}" "${PROJECT_NAME}"
    cd "${OLDPWD}"

    # Cleanup
    rm -rf "${TEMP_DIR}"
fi

# Display archive info
if [ -f "${ARCHIVE_NAME}" ]; then
    SIZE=$(du -h "${ARCHIVE_NAME}" | cut -f1)
    echo ""
    echo "✓ Archive created successfully!"
    echo "  File: ${ARCHIVE_NAME}"
    echo "  Size: ${SIZE}"
    echo ""
    echo "Archive contents (first 20 files):"
    unzip -l "${ARCHIVE_NAME}" | head -n 25
else
    echo "Error: Failed to create archive"
    exit 1
fi