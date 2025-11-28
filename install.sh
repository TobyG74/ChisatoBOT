#!/bin/bash

# Install NodeJS via NVM
if ! command -v node &> /dev/null
then
    echo "NodeJS could not be found, installing via NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
    export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
    nvm install --lts
else
    echo "NodeJS is already installed."
fi

# Install git
if ! command -v git &> /dev/null
then
    echo "git could not be found, installing..."
    sudo apt-get update
    sudo apt-get install -y git
else
    echo "git is already installed."    
fi


# Install libwebp
if ! command -v cwebp &> /dev/null
then
    echo "libwebp could not be found, installing..."
    sudo apt-get update
    sudo apt-get install -y libwebp-dev
else
    echo "libwebp is already installed."
fi

# Install ffmpeg
if ! command -v ffmpeg &> /dev/null
then
    echo "ffmpeg could not be found, installing..."
    sudo apt-get update
    sudo apt-get install -y ffmpeg
else
    echo "ffmpeg is already installed."
fi