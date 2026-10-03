#!/bin/sh
# Обновляет метку версии во всех ссылках на JS/CSS, чтобы браузеры не брали старые файлы из кэша.
# Запуск: ./bump-version.sh            (версия = дата-время)
#         ./bump-version.sh 2026.10.03-5
set -e
V="${1:-$(date +%Y.%m.%d-%H%M)}"
sed -i -E "s/(css\/style\.css\?v=)[^\"]*/\1$V/; s/(js\/main\.js\?v=)[^\"]*/\1$V/; s/(id=\"app-version\">)[^<]*/\1$V/" index.html
sed -i -E "s/(from '\.\/[a-z]+\.js\?v=)[^']*/\1$V/g" js/*.js
echo "version: $V"
