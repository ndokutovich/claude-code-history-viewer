#!/usr/bin/env node

/**
 * Color migration script
 * This script helps migrate hardcoded Tailwind color classes to use the centralized color constants
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Color mappings from Tailwind classes to COLORS constants
const colorMappings = {
  // Semantic error colors
  'bg-red-50': 'COLORS.semantic.error.bg',
  'bg-red-100': 'COLORS.semantic.error.bgDark',
  'border-red-200': 'COLORS.semantic.error.border',
  'text-red-600': 'COLORS.semantic.error.text',
  'text-red-800': 'COLORS.semantic.error.textDark',
  'text-red-500': 'COLORS.semantic.error.icon',
  
  // Semantic success colors
  'bg-green-50': 'COLORS.semantic.success.bg',
  'bg-green-100': 'COLORS.semantic.success.bgDark',
  'border-green-200': 'COLORS.semantic.success.border',
  'text-green-600': 'COLORS.semantic.success.text',
  'text-green-800': 'COLORS.semantic.success.textDark',
  'text-green-500': 'COLORS.semantic.success.icon',
  
  // UI colors
  'bg-gray-50': 'COLORS.ui.background.primary',
  'bg-gray-100': 'COLORS.ui.background.secondary',
  'bg-gray-800': 'COLORS.ui.background.dark',
  'bg-gray-900': 'COLORS.ui.background.darker',
  'border-gray-200': 'COLORS.ui.border.light',
  'text-gray-900': 'COLORS.ui.text.primary',
  'text-gray-700': 'COLORS.ui.text.secondary',
  'text-gray-600': 'COLORS.ui.text.tertiary',
  'text-gray-500': 'COLORS.ui.text.muted',
  'hover:bg-gray-200': 'COLORS.ui.interactive.hover',
};

// Files to process
const sourceFiles = glob.sync('src/**/*.{ts,tsx}', {
  ignore: ['**/node_modules/**', 'src/constants/colors.ts']
});

console.log(`Found ${sourceFiles.length} files to process`);

// Process each file
sourceFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  let needsImport = false;

  // Check if file already imports COLORS
  const hasColorsImport = content.includes('import { COLORS }') || content.includes('import { COLORS,');

  // Replace color classes
  Object.entries(colorMappings).forEach(([oldClass, newConstant]) => {
    // Pattern 1: Inside className string literals
    const classNamePattern = new RegExp(`className="([^"]*\\b${oldClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^"]*)"`, 'g');
    if (classNamePattern.test(content)) {
      content = content.replace(classNamePattern, (match, classes) => {
        hasChanges = true;
        needsImport = true;
        return `className={\`${classes.replace(oldClass, '${' + newConstant + '}')}\`}`;
      });
    }

    // Pattern 2: Inside cn() calls
    const cnPattern = new RegExp(`cn\\([^)]*"[^"]*\\b${oldClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^"]*"[^)]*\\)`, 'g');
    if (cnPattern.test(content)) {
      content = content.replace(cnPattern, (match) => {
        hasChanges = true;
        needsImport = true;
        // This is more complex and would need careful handling
        console.log(`Manual review needed for cn() usage in ${filePath}: ${match}`);
        return match;
      });
    }
  });

  // Add import if needed
  if (needsImport && !hasColorsImport) {
    // Find the last import statement
    const lastImportMatch = content.match(/^import[^;]+;$/gm);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      content = content.slice(0, lastImportIndex + lastImport.length) +
        '\nimport { COLORS } from "../constants/colors";' +
        content.slice(lastImportIndex + lastImport.length);
    }
  }

  // Write back if changes were made
  if (hasChanges) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Updated ${filePath}`);
  }
});

console.log('\nMigration complete!');
console.log('Note: Some complex cases may need manual review, especially cn() calls with dynamic classes.');