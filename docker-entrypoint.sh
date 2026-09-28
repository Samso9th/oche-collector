#!/bin/sh
# Writes the runtime config the app reads before it boots.
set -e
: "${API_URL:?Set API_URL to the Oche server URL, e.g. https://deploy.oche.io}"
printf 'window.__OCHE__ = { apiUrl: "%s" };\n' "$API_URL" > /usr/share/nginx/html/config.js
