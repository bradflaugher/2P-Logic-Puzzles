#!/bin/bash

sudo rm -rf node_modules
sudo docker build -t nonogrambuilder .
sudo docker run -v $(pwd):/app -it --rm nonogrambuilder
