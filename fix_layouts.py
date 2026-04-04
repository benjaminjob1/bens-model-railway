#!/usr/bin/env python3
import sys

# Read original
with open('src/components/InteractiveTrain.tsx', 'r') as f:
    original = f.read()

lines = original.split('\n')

# Find where FACTORIES line is (should be around line 250-252)
factory_line = None
for i, line in enumerate(lines):
    if line.strip().startswith('const FACTORIES = ['):
        factory_line = i
        break

if factory_line is None:
    print("ERROR: Could not find FACTORIES line")
    sys.exit(1)

# Layouts end at factory_line (exclusive)
# Header is lines 0-13
# We replace lines 14 to factory_line with new content

print(f"FACTORIES found at line {factory_line+1}")
print(f"Header lines: 0-13 ({len(lines[:14])} lines)")
print(f"Layout replacement: lines 14-{factory_line-1} ({factory_line-14} lines)")
print(f"Keeping from line {factory_line} onwards")

# Read new layout content
with open('src/components/InteractiveTrain.layouts.txt', 'r') as f:
    new_layouts = f.read()

# Build new file
new_lines = lines[:14] + new_layouts.split('\n') + lines[factory_line:]
new_content = '\n'.join(new_lines)

with open('src/components/InteractiveTrain.tsx', 'w') as f:
    f.write(new_content)

print(f"Done! New file has {len(new_lines)} lines")
