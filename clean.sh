#!/bin/bash

echo "🧹 Cleaning build directories..."

# Clean frontend build
if [ -d "dist" ]; then
  echo "Removing dist/"
  rm -rf dist/
fi

# Clean Tauri/Rust build
if [ -d "src-tauri/target" ]; then
  echo "Removing src-tauri/target/"
  rm -rf src-tauri/target/
fi

# Clean Rust build with cargo
if [ -d "src-tauri" ]; then
  echo "Running cargo clean..."
  cd src-tauri && cargo clean && cd ..
fi

# Clean node_modules if specified
if [ "$1" == "--all" ] || [ "$1" == "-a" ]; then
  if [ -d "node_modules" ]; then
    echo "Removing node_modules/"
    rm -rf node_modules/
  fi
  if [ -f "pnpm-lock.yaml" ]; then
    echo "Removing pnpm-lock.yaml"
    rm pnpm-lock.yaml
  fi
fi

echo "✅ Clean complete!"
echo ""
echo "Usage:"
echo "  ./clean.sh          # Clean build artifacts only"
echo "  ./clean.sh --all    # Clean everything including node_modules"
