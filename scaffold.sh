#!/usr/bin/env bash

set -e

echo "Scaffolding Aura Volley Group LLC Next.js structure..."

# Helper: create file only if it doesn't exist
touch_safe () {
  if [ ! -f "$1" ]; then
    mkdir -p "$(dirname "$1")"
    touch "$1"
    echo "Created: $1"
  else
    echo "Skipped (exists): $1"
  fi
}

# Directories
dirs=(
  "src/app"
  "src/app/team/[slug]"
  "src/app/store/[slug]"
  "src/app/drops/[slug]"
  "src/components"
  "src/content"
  "src/lib"
  "public/og"
  ".github/workflows"
)

for dir in "${dirs[@]}"; do
  mkdir -p "$dir"
  echo "Ensured dir: $dir"
done

# App files
app_files=(
  "src/app/layout.tsx"
  "src/app/page.tsx"
  "src/app/globals.css"
  "src/app/team/page.tsx"
  "src/app/team/[slug]/page.tsx"
  "src/app/store/page.tsx"
  "src/app/store/[slug]/page.tsx"
  "src/app/drops/page.tsx"
  "src/app/drops/[slug]/page.tsx"
)

# Components
component_files=(
  "src/components/Nav.tsx"
  "src/components/Footer.tsx"
  "src/components/Container.tsx"
  "src/components/PageHeader.tsx"
  "src/components/ProductCard.tsx"
  "src/components/PlayerCard.tsx"
  "src/components/FeaturedCarousel.tsx"
  "src/components/PlaceholderImage.tsx"
  "src/components/Chips.tsx"
)

# Content
content_files=(
  "src/content/drops.ts"
  "src/content/products.ts"
  "src/content/players.ts"
)

# Lib
lib_files=(
  "src/lib/format.ts"
  "src/lib/content.ts"
)

# Config / workflow
config_files=(
  "next.config.ts"
  ".github/workflows/deploy.yml"
)

# Optional placeholder
public_files=(
  "public/og/placeholder.png"
)

# Create everything
for file in \
  "${app_files[@]}" \
  "${component_files[@]}" \
  "${content_files[@]}" \
  "${lib_files[@]}" \
  "${config_files[@]}" \
  "${public_files[@]}"; do
  touch_safe "$file"
done

echo ""
echo "Scaffold complete."
echo "Next steps:"
echo "1) Paste the provided code into each file"
echo "2) npm install"
echo "3) npm run dev"
