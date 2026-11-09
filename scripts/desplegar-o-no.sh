#!/bin/sh
# Lo que Vercel pregunta antes de cada despliegue (ignoreCommand en vercel.json). Si desde el último despliegue solo
# cambió lo que no es de la web (los carteles de publicidad/, los sellos, los guiones de scripts/ y los textos del
# repositorio), no se despliega: cada versión publicada ocupa sitio en Vercel, y el plan gratuito tiene 10 GB.
# Sale con 0 para no desplegar y con 1 para desplegar. Ante la duda, despliega.
previo="$VERCEL_GIT_PREVIOUS_SHA"
if [ -z "$previo" ] || ! git cat-file -e "$previo^{commit}" 2>/dev/null; then
  echo "No está a mano el último despliegue: se despliega."
  exit 1
fi
if git diff --quiet "$previo" HEAD -- . ':(exclude)publicidad' ':(exclude)sellos' ':(exclude)scripts' ':(exclude)README.md' ':(exclude)AGENTS.md' ':(exclude)CLAUDE.md'; then
  echo "Desde $previo solo cambió lo que no es de la web: no se despliega."
  exit 0
fi
echo "Cambió la web desde $previo: se despliega."
exit 1
