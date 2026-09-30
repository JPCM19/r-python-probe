# R Python Probe

Extensión local de VS Code para elegir R y Radian desde el entorno Conda seleccionado por la extensión Python. Uso personal.

## Requisitos

- Windows y VS Code 1.95 o posterior.
- Extensiones `ms-python.python` y `REditorSupport.r`.
- Entorno Conda con Python, R y Radian instalados.
- Distribución Conda con estructura `envs/<entorno>` y `condabin/conda.bat`.
- Un proyecto por ventana de VS Code para evitar conflictos de DLL entre entornos.

## Funcionamiento

Al iniciar VS Code o cambiar el intérprete Python, sincroniza `r.executablePath` y `r.consolePath` en la configuración del proyecto. Genera un lanzador de Radian en el almacenamiento de la extensión y prepara las rutas de DLL de Conda para R en segundo plano y terminales.

No abre terminales automáticamente ni añade pasos para ejecutar código. `Ctrl+Enter` sigue siendo funcionalidad de la extensión R. Una terminal R existente no cambia de entorno: debe cerrarse y abrirse nuevamente.

Los ajustes se guardan por proyecto. El `PATH` del host de extensiones se modifica temporalmente por ventana; no cambia el `PATH` del sistema.

## Archivos

- `extension.js`: código de la extensión.
- `extension.test.js`: autoprueba sin dependencias externas.
- `package.json`: manifiesto de VS Code.
- `r-python-probe.vsix`: paquete instalable local, excluido de Git.

## Verificar

Desde esta carpeta:

```sh
node --check extension.js
node extension.test.js
```

## Empaquetar

Desde esta carpeta, con Node.js y npm disponibles:

```sh
npx --yes --package @vscode/vsce vsce package --no-dependencies --allow-missing-repository --skip-license --out r-python-probe.vsix
```

El empaquetador se obtiene temporalmente; la extensión no necesita dependencias npm para ejecutarse. No hay licencia de distribución definida: este paquete se conserva para uso personal.

## Instalar o actualizar

En VS Code, abre Extensiones, menú de opciones, **Install from VSIX…**, y selecciona `r-python-probe.vsix`. Después ejecuta **Developer: Reload Window**.

La extensión instalada no depende de esta carpeta. Conserva el código para corregir problemas y generar nuevas versiones.

## Estado y límites

- Autoprueba de sincronización disponible; no sustituye una prueba interactiva en VS Code.
- Radian y la terminal R funcionaron en el entorno probado.
- Queda pendiente diagnosticar el aviso ocasional: `Failed to get list of R functions. Make sure that jsonlite is installed and r.executablePath points to a valid R executable.`
- Solo admite Windows y la estructura Conda indicada; otros gestores o entornos ubicados fuera de `envs/` requieren adaptación.
- Puede reemplazar rutas R y el valor `PATH` de terminales configurados en el proyecto. Revisa ajustes personalizados antes de usarla en otro proyecto.
- No se ha validado aislamiento entre varias carpetas con distintos entornos en una misma ventana.

## Repositorio

Git ya está inicializado. No requiere remoto ni repositorio privado en GitHub. Guarda código fuente y documentación en Git; conserva el `.vsix` como artefacto local o respaldo separado.
