---

description: Crea un worktree aislado en .trees/<nombre> (nombre derivado del requerimiento) y ejecuta ahí las instrucciones, sin tocar el código principal.
argument-hint: "<requerimiento a implementar>"
allowed-tools: Bash(git worktree:*), Bash(git branch:*), Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git -C:*)
---

# /worktree

Requerimiento recibido:

<requerimiento>
$ARGUMENTS
</requerimiento>

Si el requerimiento está vacío, pide al usuario qué quiere implementar y detente.

## 1. Elegir el nombre

Deriva un nombre corto a partir del requerimiento:

- kebab-case, en español, de 1 a 3 palabras, solo `[a-z0-9-]`, sin tildes ni ñ (ej. `tabla-records`, `modo-oscuro`, `fix-rotacion`).
- Prefijo `fix-` si es una corrección de bug.
- El mismo nombre se usa para la carpeta y para la rama.

Comprueba que no exista ya:

```bash
git worktree list
git branch --list "<nombre>"
```

Si la carpeta `.trees/<nombre>` o la rama `<nombre>` ya existen, añade un sufijo (`-2`, `-3`, …) hasta encontrar uno libre. Nunca reutilices ni borres un worktree o rama existente.

## 2. Crear el worktree

Desde la raíz del repositorio principal, partiendo de la rama actual:

```bash
git worktree add .trees/<nombre> -b <nombre>
```

Guarda la ruta absoluta del worktree: `WT=<raíz del repo>/.trees/<nombre>`.

## 3. Trabajar de forma aislada

A partir de aquí todo el trabajo ocurre **solo** dentro de `$WT`:

- Lee, edita y crea archivos usando siempre rutas absolutas bajo `$WT/...`. Nunca edites archivos de la raíz del repositorio principal.
- Ejecuta git con `git -C "$WT" ...` (status, diff, add, commit).
- Respeta el `CLAUDE.md` del worktree (`$WT/CLAUDE.md`): invariantes del juego, textos y comentarios en español.
- Si el cambio altera una invariante documentada, actualiza también `$WT/CLAUDE.md` y, si aplica, `$WT/README.md`.

Implementa el requerimiento completo.

## 4. Cerrar

1. Revisa el diff: `git -C "$WT" diff`.
2. Haz commit en la rama del worktree con un mensaje Conventional Commits en español (ej. `feat: añadir ...`, `fix: ...`).
3. No hagas merge a la rama principal, no hagas push y no elimines el worktree: eso lo decide el usuario.

## 5. Respuesta final

Informa en español y breve:

- Nombre del worktree y de la rama, y su ruta.
- Qué se cambió (archivos y resumen).
- Hash del commit.
- Cómo probarlo: abrir `.trees/<nombre>/index.html` en el navegador.
- Siguientes pasos posibles: merge a la rama principal, o `git worktree remove .trees/<nombre>` + `git branch -d <nombre>` si se descarta.