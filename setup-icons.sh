#!/bin/bash
# SubTranslate - Quick Setup Script
# This script helps set up the extension icons

# Create icons directory if it doesn't exist
mkdir -p icons

# Create simple SVG icons and convert to PNG
# Using ImageMagick if available, otherwise creating placeholder files

create_svg_icon() {
    local size=$1
    local file="icons/icon-${size}.png"
    
    # Create SVG content
    cat > /tmp/icon-${size}.svg << EOF
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="$((size/4))" fill="url(#grad)"/>
  
  <!-- Movie camera icon -->
  <circle cx="$((size/2))" cy="$((size/2))" r="$((size/3))" fill="none" stroke="white" stroke-width="$((size/16))"/>
  
  <!-- Play triangle inside circle -->
  <polygon points="$((size/2-size/12)),$((size/2-size/12)) $((size/2-size/12)),$((size/2+size/12)) $((size/2+size/6)),$((size/2))" fill="white"/>
  
  <!-- Subtitle text bars -->
  <rect x="$((size/8))" y="$((size*3/4-size/24))" width="$((size*6/8))" height="$((size/24))" rx="$((size/48))" fill="white" opacity="0.8"/>
  <rect x="$((size/8))" y="$((size*3/4+size/24))" width="$((size*4/8))" height="$((size/24))" rx="$((size/48))" fill="white" opacity="0.6"/>
</svg>
EOF

    # Try to convert with ImageMagick if available
    if command -v convert &> /dev/null; then
        convert /tmp/icon-${size}.svg -background none "${file}"
        echo "Created ${file}"
    else
        echo "ImageMagick not found. Please manually add icon-${size}.png files or use an online SVG to PNG converter."
        echo "SVG source saved to /tmp/icon-${size}.svg"
    fi
}

# Create icons
echo "Creating extension icons..."
create_svg_icon 16
create_svg_icon 48
create_svg_icon 128

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Navigate to brave://extensions/"
echo "2. Enable 'Developer mode' (toggle in top-right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the subTranslate directory"
echo ""
echo "Happy translating! 🎬🌍"
