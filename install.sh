#!/bin/bash

# ChisatoBOT Installer for Linux/macOS
# Author: TobyG74
# Description: Automated installation script for ChisatoBOT on Linux/macOS

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}   ChisatoBOT Installer for Linux/macOS${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to check Node.js version
check_node_version() {
    local version=$(node --version | sed 's/v\([0-9]*\).*/\1/')
    if [ "$version" -ge 16 ]; then
        return 0
    else
        return 1
    fi
}

# Check prerequisites
echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"
echo ""

# Check Git
if command_exists git; then
    echo -e "${GREEN}✓ Git is installed: $(git --version)${NC}"
else
    echo -e "${RED}✗ Git is not installed!${NC}"
    echo -e "${YELLOW}  Please install Git:${NC}"
    echo "  - Ubuntu/Debian: sudo apt-get install git"
    echo "  - CentOS/RHEL: sudo yum install git"
    echo "  - macOS: brew install git"
    exit 1
fi

# Check Node.js
if command_exists node; then
    if check_node_version; then
        echo -e "${GREEN}✓ Node.js is installed: $(node --version)${NC}"
    else
        echo -e "${RED}✗ Node.js version is too old: $(node --version)${NC}"
        echo -e "${YELLOW}  Please install Node.js 16+ from: https://nodejs.org/${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Node.js is not installed!${NC}"
    echo -e "${YELLOW}  Please install Node.js 16+ from: https://nodejs.org/${NC}"
    echo "  Or use: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "          sudo apt-get install -y nodejs"
    exit 1
fi

# Check NPM
if command_exists npm; then
    echo -e "${GREEN}✓ NPM is installed: v$(npm --version)${NC}"
else
    echo -e "${RED}✗ NPM is not installed!${NC}"
    exit 1
fi

# Check FFmpeg
if command_exists ffmpeg; then
    echo -e "${GREEN}✓ FFmpeg is installed${NC}"
else
    echo -e "${RED}✗ FFmpeg is not installed!${NC}"
    echo -e "${YELLOW}  Please install FFmpeg:${NC}"
    echo "  - Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "  - CentOS/RHEL: sudo yum install ffmpeg"
    echo "  - macOS: brew install ffmpeg"
    exit 1
fi

# Check WebP (optional but recommended)
if command_exists cwebp; then
    echo -e "${GREEN}✓ WebP is installed${NC}"
else
    echo -e "${YELLOW}⚠ WebP is not installed (optional)${NC}"
    echo -e "${YELLOW}  For better sticker support, install WebP:${NC}"
    echo "  - Ubuntu/Debian: sudo apt-get install webp"
    echo "  - macOS: brew install webp"
fi

echo ""
echo -e "${YELLOW}[2/7] Installing dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to install dependencies!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dependencies installed successfully${NC}"

echo ""
echo -e "${YELLOW}[3/7] Setting up environment file...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ .env file created from .env.example${NC}"
        echo -e "${YELLOW}  Please edit .env file with your configuration${NC}"
    else
        echo -e "${YELLOW}⚠ .env.example not found, creating default .env${NC}"
        cat > .env << 'EOF'
DATABASE_URL=mongodb://localhost:27017/chisatobot
DASHBOARD_PORT=3000
JWT_SECRET=your-secret-key-change-this
PROXY=
OCR_APIKEY=
EOF
        echo -e "${GREEN}✓ Default .env file created${NC}"
        echo -e "${YELLOW}  Please edit .env file with your configuration${NC}"
    fi
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

echo ""
echo -e "${YELLOW}[4/7] Setting up Prisma...${NC}"
npx prisma generate
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to generate Prisma client!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Prisma client generated successfully${NC}"

echo ""
echo -e "${YELLOW}[5/7] Pushing database schema...${NC}"
npx prisma db push
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to push database schema!${NC}"
    echo -e "${YELLOW}  Make sure your DATABASE_URL in .env is correct${NC}"
    echo -e "${YELLOW}  For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/dbname${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Database schema pushed successfully${NC}"

echo ""
echo -e "${YELLOW}[6/7] Building TypeScript project...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to build project!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Project built successfully${NC}"

echo ""
echo -e "${YELLOW}[7/7] Checking config.json...${NC}"
if [ -f "config.json" ]; then
    echo -e "${GREEN}✓ config.json exists${NC}"
else
    echo -e "${YELLOW}⚠ config.json not found${NC}"
    echo -e "${YELLOW}  Please make sure to configure config.json before running the bot${NC}"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}   Installation Completed Successfully!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Edit .env file with your database and API keys"
echo "2. Edit config.json with your owner number and settings"
echo "3. Run the bot with one of these commands:"
echo -e "   ${CYAN}- npm start${NC}                 (Run normally)"
echo -e "   ${CYAN}- npm run pm2:start${NC}         (Run with PM2)"
echo -e "   ${CYAN}- npm run dev${NC}               (Development mode)"
echo ""
echo -e "${GREEN}Dashboard will be available at: http://localhost:3000${NC}"
echo ""
echo -e "${CYAN}For more information, visit: https://github.com/TobyG74/ChisatoBOT${NC}"
echo ""